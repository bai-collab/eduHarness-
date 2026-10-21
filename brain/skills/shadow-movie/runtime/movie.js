(function attachShadowMovie(global) {
  "use strict";

  function makeElement(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function lerp(from, to, progress) {
    return from + (to - from) * progress;
  }

  function formatTime(seconds) {
    var safe = Math.max(0, Number(seconds) || 0);
    var minutes = Math.floor(safe / 60);
    var rest = Math.floor(safe % 60);
    return String(minutes).padStart(2, "0") + ":" + String(rest).padStart(2, "0");
  }

  function safeSourceMap(bundle) {
    return bundle && bundle.assets && bundle.assets.sources ? bundle.assets.sources : {};
  }

  class ShadowMoviePlayer {
    constructor(root, bundle) {
      this.root = root;
      this.bundle = bundle || {};
      this.manifest = this.bundle.manifest || {};
      this.storyboard = this.bundle.storyboard || { shots: [] };
      this.shots = Array.isArray(this.storyboard.shots) ? this.storyboard.shots : [];
      this.assetDocument = this.bundle.assets || { assets: [] };
      this.assetManifest = Array.isArray(this.assetDocument.assets) ? this.assetDocument.assets : [];
      this.assetMap = new Map(this.assetManifest.map(function (asset) { return [asset.id, asset]; }));
      this.sources = safeSourceMap(this.bundle);
      this.totalDuration = this.shots.reduce(function (sum, shot) { return sum + (Number(shot.duration) || 0); }, 0);
      this.time = 0;
      this.playbackRate = 1;
      this.playing = false;
      this.shotIndex = -1;
      this.lastTimestamp = 0;
      this.frameRequest = 0;
      this.characterElements = new Map();
      this.shotCharacterMap = new Map();
      this.worldScale = 1;

      this.buildInterface();
      this.bindControls();
      this.resize();
      this.render();
    }

    buildInterface() {
      this.root.className = "shadow-app";

      var header = makeElement("header", "movie-header");
      var titleGroup = makeElement("div");
      titleGroup.append(
        makeElement("h1", "", this.manifest.title || "皮影戲網頁電影"),
        makeElement("p", "", "v" + (this.manifest.version || "0.2.0") + " · " + (this.manifest.fps || 24) + " fps")
      );
      header.append(titleGroup);
      this.status = makeElement("p", "movie-status", "狀態：已載入");
      header.append(this.status);

      this.stage = makeElement("section", "movie-stage");
      this.stage.setAttribute("aria-label", "皮影戲電影舞台");
      this.sky = makeElement("div", "movie-sky");
      this.world = makeElement("div", "shadow-camera-world");
      this.layerFar = makeElement("div", "movie-layer movie-layer-far");
      this.layerMiddle = makeElement("div", "movie-layer movie-layer-middle");
      this.layerGround = makeElement("div", "movie-layer movie-layer-ground");
      this.characters = makeElement("div", "movie-characters");
      this.subtitle = makeElement("p", "movie-subtitle");
      this.subtitle.hidden = true;
      this.subtitleOverlay = makeElement("div", "movie-subtitle-overlay");
      this.subtitleOverlay.append(this.subtitle);
      this.world.append(this.layerFar, this.layerMiddle, this.layerGround, this.characters);
      this.stage.append(this.sky, this.world, this.subtitleOverlay);

      this.controls = makeElement("section", "movie-controls");
      this.controls.setAttribute("aria-label", "電影控制列");
      this.timeline = makeElement("input", "movie-timeline");
      this.timeline.type = "range";
      this.timeline.min = "0";
      this.timeline.max = String(this.totalDuration);
      this.timeline.step = String(1 / (this.manifest.fps || 24));
      this.timeline.value = "0";
      this.timeline.setAttribute("aria-label", "播放時間");

      this.playButton = makeElement("button", "", "播放");
      this.playButton.type = "button";
      this.playButton.setAttribute("aria-label", "播放或暫停");
      this.restartButton = makeElement("button", "", "重播");
      this.restartButton.type = "button";
      this.restartButton.setAttribute("aria-label", "回到開頭");
      this.previousButton = makeElement("button", "", "上一格");
      this.previousButton.type = "button";
      this.nextButton = makeElement("button", "", "下一格");
      this.nextButton.type = "button";

      this.timeLabel = makeElement("span", "movie-time", "00:00 / " + formatTime(this.totalDuration));
      this.shotSelect = makeElement("select", "movie-shot-select");
      this.shotSelect.setAttribute("aria-label", "選擇鏡頭");
      this.shots.forEach(function (shot, index) {
        var option = makeElement("option", "", String(index + 1).padStart(2, "0") + " · " + shot.shot_id);
        option.value = String(index);
        this.shotSelect.append(option);
      }, this);
      this.speedSelect = makeElement("select", "movie-speed-select");
      this.speedSelect.setAttribute("aria-label", "播放速度");
      [0.5, 1, 1.5, 2].forEach(function (speed) {
        var option = makeElement("option", "", speed + "×");
        option.value = String(speed);
        if (speed === 1) option.selected = true;
        this.speedSelect.append(option);
      }, this);

      this.controls.append(
        this.timeline,
        this.playButton,
        this.restartButton,
        this.previousButton,
        this.nextButton,
        this.timeLabel,
        this.shotSelect,
        this.speedSelect
      );
      this.root.replaceChildren(header, this.stage, this.controls, this.status);
      this.status = this.root.querySelector(".movie-header .movie-status") || this.status;
      this.root.querySelector(".movie-header").append(this.status);
    }

    bindControls() {
      this.playButton.addEventListener("click", () => this.togglePlay());
      this.restartButton.addEventListener("click", () => this.restart());
      this.previousButton.addEventListener("click", () => this.stepFrame(-1));
      this.nextButton.addEventListener("click", () => this.stepFrame(1));
      this.timeline.addEventListener("input", () => {
        this.pause();
        this.seek(Number(this.timeline.value));
      });
      this.shotSelect.addEventListener("change", () => {
        var index = Number(this.shotSelect.value);
        this.seek(this.startTimeForShot(index));
      });
      this.speedSelect.addEventListener("change", () => {
        this.playbackRate = Number(this.speedSelect.value) || 1;
      });
      this.resizeObserver = typeof ResizeObserver === "function"
        ? new ResizeObserver(() => this.resize())
        : null;
      if (this.resizeObserver) this.resizeObserver.observe(this.stage);
      global.addEventListener("resize", () => this.resize());
    }

    resize() {
      var resolution = this.manifest.resolution || { width: 1920, height: 1080 };
      var width = this.stage.clientWidth || resolution.width;
      this.worldScale = width / resolution.width;
      this.world.style.width = resolution.width + "px";
      this.world.style.height = resolution.height + "px";
      this.render();
    }

    startTimeForShot(index) {
      var start = 0;
      for (var cursor = 0; cursor < index && cursor < this.shots.length; cursor += 1) {
        start += Number(this.shots[cursor].duration) || 0;
      }
      return start;
    }

    shotAt(time) {
      var cursor = 0;
      for (var index = 0; index < this.shots.length; index += 1) {
        var duration = Number(this.shots[index].duration) || 0;
        if (time < cursor + duration || index === this.shots.length - 1) {
          return { shot: this.shots[index], index: index, localTime: clamp(time - cursor, 0, duration) };
        }
        cursor += duration;
      }
      return { shot: null, index: -1, localTime: 0 };
    }

    seek(time) {
      this.time = clamp(Number(time) || 0, 0, this.totalDuration);
      this.render();
    }

    togglePlay() {
      if (this.playing) this.pause();
      else this.play();
    }

    play() {
      if (!this.shots.length) return;
      if (this.time >= this.totalDuration) this.time = 0;
      this.playing = true;
      this.playButton.textContent = "暫停";
      this.status.textContent = "狀態：播放中";
      this.lastTimestamp = performance.now();
      this.frameRequest = requestAnimationFrame((timestamp) => this.tick(timestamp));
    }

    pause() {
      this.playing = false;
      this.playButton.textContent = "播放";
      if (this.frameRequest) cancelAnimationFrame(this.frameRequest);
      this.frameRequest = 0;
      this.status.textContent = "狀態：已暫停";
    }

    restart() {
      this.pause();
      this.seek(0);
    }

    stepFrame(direction) {
      this.pause();
      this.seek(this.time + direction / (this.manifest.fps || 24));
    }

    tick(timestamp) {
      if (!this.playing) return;
      var elapsed = Math.min(0.1, Math.max(0, (timestamp - this.lastTimestamp) / 1000));
      this.lastTimestamp = timestamp;
      this.time += elapsed * this.playbackRate;
      if (this.time >= this.totalDuration) {
        this.time = this.totalDuration;
        this.pause();
      }
      this.render();
      if (this.playing) this.frameRequest = requestAnimationFrame((next) => this.tick(next));
    }

    mountSvg(container, source, label) {
      container.replaceChildren();
      if (typeof source !== "string" || !source.trim()) {
        var fallback = makeElement("span", "", label || "缺少 SVG 資產");
        fallback.textContent = label || "缺少 SVG 資產";
        container.append(fallback);
        return null;
      }
      var parsed = new DOMParser().parseFromString(source, "image/svg+xml");
      var parserError = parsed.querySelector("parsererror");
      if (parserError || !parsed.documentElement || parsed.documentElement.tagName.toLowerCase() !== "svg") {
        var errorText = makeElement("span", "", "SVG 無法載入");
        container.append(errorText);
        return null;
      }
      var svg = document.importNode(parsed.documentElement, true);
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      container.append(svg);
      return svg;
    }

    mountImage(container, source, label) {
      container.replaceChildren();
      if (typeof source !== "string" || !source.trim()) {
        var fallback = makeElement("span", "", label || "缺少 PNG 資產");
        fallback.textContent = label || "缺少 PNG 資產";
        container.append(fallback);
        return null;
      }
      var image = makeElement("img");
      image.src = source;
      image.alt = label || "PNG 資產";
      image.decoding = "async";
      image.draggable = false;
      container.append(image);
      return image;
    }

    mountMedia(container, source, format, label) {
      return format === "png"
        ? this.mountImage(container, source, label)
        : this.mountSvg(container, source, label);
    }

    syncShot(shot) {
      this.characterElements.clear();
      this.shotCharacterMap.clear();
      this.characters.replaceChildren();
      var background = this.assetMap.get(shot.background);
      var backgroundSources = background ? (this.sources[background.id] || {}) : {};
      if (backgroundSources.src) {
        this.layerFar.replaceChildren();
        this.layerMiddle.replaceChildren();
        this.mountMedia(this.layerGround, backgroundSources.src, background ? background.format : "svg", background ? background.name : "背景");
      } else {
        this.layerFar.replaceChildren();
        this.layerMiddle.replaceChildren();
        this.layerGround.replaceChildren();
        if (backgroundSources.far) this.mountMedia(this.layerFar, backgroundSources.far, background ? background.format : "svg", "遠景");
        if (backgroundSources.middle) this.mountMedia(this.layerMiddle, backgroundSources.middle, background ? background.format : "svg", "中景");
        if (backgroundSources.ground) this.mountMedia(this.layerGround, backgroundSources.ground, background ? background.format : "svg", "地景");
      }

      (shot.characters || []).forEach(function (character) {
        var asset = this.assetMap.get(character.id);
        var sources = asset ? (this.sources[asset.id] || {}) : {};
        var element = makeElement("div", "movie-character");
        element.dataset.characterId = character.id;
        element.setAttribute("aria-label", asset ? asset.name : character.id);
        var view = character.view || "side";
        var frameSources = sources.frame_sequence && Array.isArray(sources.frame_sequence.frames)
          ? sources.frame_sequence.frames
          : [];
        var source = frameSources[0] || sources[view] || sources.side || sources.src;
        this.mountMedia(element, source, asset ? asset.format : "svg", asset ? asset.name : character.id);
        element._shadowMovieFrameIndex = -1;
        this.characters.append(element);
        this.characterElements.set(character.id, element);
        this.shotCharacterMap.set(character.id, character);
      }, this);
    }

    characterPosition(character, localTime, duration, cache, visiting) {
      if (cache.has(character.id)) return cache.get(character.id);
      if (visiting.has(character.id)) return { x: 0, y: 0, rotation: 0 };
      visiting.add(character.id);
      var progress = duration > 0 ? clamp(localTime / duration, 0, 1) : 0;
      var position;
      if (character.mount_on) {
        var parent = this.shotCharacterMap.get(character.mount_on);
        var parentPosition = parent
          ? this.characterPosition(parent, localTime, duration, cache, visiting)
          : { x: 0, y: 0, rotation: 0 };
        var offset = character.mount_offset || { x: 0, y: 0 };
        position = {
          x: parentPosition.x + offset.x,
          y: parentPosition.y + offset.y,
          rotation: parentPosition.rotation
        };
      } else {
        var from = character.from || { x: 0, y: 0 };
        var to = character.to || from;
        position = {
          x: lerp(from.x, to.x, progress),
          y: lerp(from.y, to.y, progress),
          rotation: Number(character.rotation) || 0
        };
      }
      visiting.delete(character.id);
      cache.set(character.id, position);
      return position;
    }

    applySpineKinematics(element, character, localTime) {
      var svg = element.querySelector("svg");
      if (!svg) return;
      svg.querySelectorAll("[data-joint]").forEach(function (part) {
        part.style.transform = "";
      });
      var phase = localTime * 6 + String(character.id || "").length;
      if (character.animation === "walk" || character.animation === "riding") {
        var frontLeg = svg.querySelector("#part-leg-front");
        var backLeg = svg.querySelector("#part-leg-back");
        if (frontLeg) frontLeg.style.transform = "rotate(" + Math.sin(phase) * 8 + "deg)";
        if (backLeg) backLeg.style.transform = "rotate(" + Math.sin(phase + Math.PI) * 8 + "deg)";
      }
      if (character.animation === "look_up") {
        var head = svg.querySelector("#part-head");
        if (head) head.style.transform = "rotate(-12deg)";
      }
      if (character.animation === "fly") {
        var tail = svg.querySelector("#dragon-tail");
        var neck = svg.querySelector("#dragon-neck");
        if (tail) tail.style.transform = "rotate(" + Math.sin(phase) * 5 + "deg)";
        if (neck) neck.style.transform = "rotate(" + Math.sin(phase + 0.8) * 3 + "deg)";
      }
    }

    updateFrameSequence(element, asset, localTime) {
      var sequence = asset && asset.frame_sequence;
      var sourceSequence = asset && this.sources[asset.id] && this.sources[asset.id].frame_sequence;
      var frames = sourceSequence && Array.isArray(sourceSequence.frames) ? sourceSequence.frames : [];
      if (!sequence || asset.format !== "png" || !frames.length) return;
      var fps = Number(this.manifest.fps) || 24;
      var holdTicks = Math.max(1, Math.floor(Number(sequence.hold_ticks) || 3));
      var phaseTicks = Math.max(0, Math.floor(Number(sequence.phase_ticks) || 0));
      var tick = Math.max(0, Math.floor((Number(localTime) || 0) * fps + 1e-8));
      var frameNumber = Math.floor((tick + phaseTicks) / holdTicks);
      var frameIndex = sequence.loop === false
        ? Math.min(frameNumber, frames.length - 1)
        : frameNumber % frames.length;
      if (element._shadowMovieFrameIndex === frameIndex) return;
      var image = element.querySelector("img");
      if (!image) return;
      image.src = frames[frameIndex];
      element._shadowMovieFrameIndex = frameIndex;
    }

    renderCharacters(shot, localTime) {
      var cache = new Map();
      (shot.characters || []).forEach(function (character) {
        var element = this.characterElements.get(character.id);
        if (!element) return;
        var asset = this.assetMap.get(character.id);
        var position = this.characterPosition(character, localTime, shot.duration, cache, new Set());
        var scale = Number(character.scale) || 1;
        var facing = character.facing === "left" ? -1 : 1;
        var rotation = position.rotation;
        element.style.transform = "translate3d(" + position.x + "px, " + position.y + "px, 0) rotate(" + rotation + "deg) scale(" + (scale * facing) + ", " + scale + ")";
        this.updateFrameSequence(element, asset, localTime);
        this.applySpineKinematics(element, character, localTime);
      }, this);
    }

    renderSubtitle(shot, localTime) {
      var active = (shot.subtitles || []).find(function (subtitle) {
        return localTime >= subtitle.start && localTime <= subtitle.end;
      });
      this.subtitle.textContent = active ? active.text : "";
      this.subtitle.hidden = !active;
    }

    render() {
      if (!this.shots.length) {
        this.status.textContent = "狀態：沒有可播放的鏡頭";
        return;
      }
      var frame = this.shotAt(this.time);
      if (!frame.shot) return;
      if (frame.index !== this.shotIndex) {
        this.shotIndex = frame.index;
        this.shotSelect.value = String(frame.index);
        this.syncShot(frame.shot);
      }
      var camera = frame.shot.camera || { from: { x: 0, y: 0, scale: 1 } };
      var from = camera.from || { x: 0, y: 0, scale: 1 };
      var to = camera.to || from;
      var progress = frame.shot.duration > 0 ? clamp(frame.localTime / frame.shot.duration, 0, 1) : 0;
      var cameraX = lerp(from.x, to.x, progress);
      var cameraY = lerp(from.y, to.y, progress);
      var cameraScale = lerp(from.scale, to.scale, progress);
      var fit = this.worldScale;
      this.world.style.transform = "translate3d(" + (-cameraX * fit) + "px, " + (-cameraY * fit) + "px, 0) scale(" + (fit * cameraScale) + ")";
      this.renderCharacters(frame.shot, frame.localTime);
      this.renderSubtitle(frame.shot, frame.localTime);
      this.timeline.value = String(this.time);
      this.timeLabel.textContent = formatTime(this.time) + " / " + formatTime(this.totalDuration);
      this.status.textContent = (this.playing ? "狀態：播放中" : "狀態：已暫停") + " · 鏡頭 " + (frame.index + 1) + "/" + this.shots.length;
    }
  }

  global.ShadowMoviePlayer = ShadowMoviePlayer;
})(window);
