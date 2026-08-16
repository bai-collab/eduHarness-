# 給 AI 參考的設計風格清單

> 來源：DesEngs（https://desengs.com），由 design engineer 親自策劃。
> 整理日期：2026-08-13。原始筆記：references/line-notes/mirror/notes/2026/08/2026-08-08-230311-DesEngs-Resources-for-Design-Engineers.md
> 用途：生成網站／介面時，把「原則規範類」與「AI skill 類」直接餵給 AI 當守則；元件與動畫類作為視覺與互動風格的參照樣本。

---

## ⭐ 最適合直接餵給 AI（原則、規範、可蒸餾的 skill）

這幾類是文字化的規則或可載入的 skill 檔，塞進 prompt 或當專案守則收益最高。

### 設計原則與介面規範
| 名稱 | 連結 | 說明 |
|---|---|---|
| Laws of UX | https://lawsofux.com/ | UI 建構最佳實務合集，AI 生成時的決策框架 |
| Web Interface Guidelines | https://interfaces.rauno.me/ | 好網頁介面的細節清單（Rauno，Vercel）|
| Design Principles | https://principles.design/ | 各家設計原則策展，決策框架 |
| Design System Checklist | https://www.designsystemchecklist.com/ | 規劃／建立／擴張設計系統的開源檢查表 |
| userinterface.wiki | https://userinterface.wiki/ | 「更好介面」的活手冊 |
| Interface Craft | https://www.interfacecraft.dev/ | 以罕見細膩度設計介面的工作庫 |

### 給 AI Agent 的 skill 檔（可直接載入蒸餾）
| 名稱 | 連結 | 說明 |
|---|---|---|
| Taste Skill | https://www.tasteskill.dev/ | 給 AI coding agent 的開源 skill 檔 |
| UI Skills | https://www.ui-skills.com/ | 打磨介面的 agent skills |
| Impeccable | https://impeccable.style/ | 「1 skill、20 指令」給 AI coding 工具做前端設計 |
| jakubkrehel/skills | https://github.com/jakubkrehel/skills | 動畫／字體／版面／顏色的 agent skills |
| emilkowalski/skills | https://github.com/emilkowalski/skills | design engineer 的 skills repo |
| rams | https://www.rams.ai/ | 自動化設計審查，抓無障礙與視覺 bug |

---

## 🎨 視覺風格參照（元件、動畫、細節）

### UI 元件庫（可抄的視覺／互動樣本）
| 名稱 | 連結 | 說明 |
|---|---|---|
| Magic UI | https://magicui.design/ | 漂亮的 UI 元件與 landing page 模板 |
| Fancy Components | https://www.fancycomponents.dev/ | 即用型花俏 React 元件（開源）|
| Sonner | https://sonner.emilkowal.ski/ | 有主見的 React toast 元件 |
| ⌘K / cmdk | https://github.com/dip/cmdk | 快速、無樣式的命令選單元件 |
| NumberFlow | https://number-flow.barvian.me/ | 數字動畫元件，無依賴、無障礙 |
| liquid-glass | https://glass.samasante.com/ | 折射即時頁面的 headless React 玻璃透鏡 |
| crd-ui | https://crd-ui.juanda.co/ | 付款卡元件，品牌辨識＋3D 翻轉 |
| Thinking orbs | https://orbs.jakubantalik.com/ | AI UI 用的點狀思考球載入指示 |
| Hashvatar | https://www.hashvatar.com/ | 決定性唯一頭像生成（漸層／dither）|
| DialKit | https://joshpuckett.me/dialkit | 浮動控制面板：滑桿／開關／取色器 |
| Torph | https://torph.lochie.me/ | 無依賴文字動畫元件 |
| devl.dev | https://devl.dev/ | 159+ 個建於 coss-ui 的元件 |
| Fluid Functionalism | https://www.fluidfunctionalism.com/ | 開源 UI 元件 |
| dither-kit | https://www.tripwire.sh/dither-kit | dither 風格可組合圖表 |
| Liveline | https://github.com/benjitaylor/liveline | React 即時動畫折線圖 |

### 動畫與過場
| 名稱 | 連結 | 說明 |
|---|---|---|
| animations.dev | https://animations.dev | Web 動畫資源站 |
| Transitions.dev | https://transitions.dev/ | Web app 必備過場合集 |
| Easing Graphs | https://www.easing.dev/ | 緩動曲線策展 |
| Calligraph | https://calligraph.raphaelsalaja.com/ | Motion 驅動的流體文字過場 |
| Liquid Gooey | https://gooey.jakubantalik.com/ | React 液態 UI 效果 |
| 12 Principles of Animation | https://www.raphaelsalaja.com/library/12-principles-of-animation | 動畫基礎原則指南 |

### 顏色／字體／陰影／細節工具
| 名稱 | 連結 | 說明 |
|---|---|---|
| OKLCH.fyi | https://oklch.fyi/ | OKLCH 顏色轉換／生成／調色盤 |
| Gradient Border Plugin | https://gradient-border.floriankiem.com/ | Tailwind 漸層邊框外掛 |
| shadowLab | https://shadowlab.mocarski.design/ | box-shadow 生成 playground |
| soundcn | https://soundcn.xyz/ | 700+ 策展 UI 音效 |
| @web-kits/audio | https://audio.raphaelsalaja.com/ | 宣告式網頁音訊合成 |
| WebHaptics | https://haptics.lochie.me | 行動網頁觸覺回饋 |
| svg.guide | https://www.svg.guide/ | 互動式 SVG 動畫迷你課 |

---

## 📚 設計系統目錄與元件庫（找對標範例）
| 名稱 | 連結 | 說明 |
|---|---|---|
| Design Systems Surf | https://designsystems.surf/ | 各大科技公司的元件與基礎彙整 |
| The Component Gallery | https://component.gallery/ | 各設計系統的介面元件倉庫 |
| UI Playbook | https://uiplaybook.dev/ | 有文件的 UI 元件合集 |
| ui.land | https://ui.land/ | 設計師與工程師的數位圖書館 |
| Devouring Details | https://devouringdetails.com/ | 互動設計的互動式參考手冊 |
| Design Engineer Tools | https://designengineer.tools/ | web design engineer 常用工具清單 |

---

## 🔍 靈感與微互動（風格 taste 養成）
| 名稱 | 連結 | 說明 |
|---|---|---|
| Design Spells | https://designspells.com | 微互動、彩蛋、設計細節 |
| abtest.design | https://abtest.design/ | 一流 app 的 A/B test 結果策展 |
| Invisible Details of Interaction Design | https://rauno.me/craft/interaction-design | 讓互動「對味」的隱形細節 |
| Details That Make Interfaces Feel Better | https://jakub.kr/writing/details-that-make-interfaces-feel-better | 提升介面手感的 UX 細節 |

---

## ✍️ 觀念文章（培養設計品味，適合當背景 prompt）
| 名稱 | 連結 | 說明 |
|---|---|---|
| Developing Taste | https://emilkowal.ski/ui/developing-taste | 設計品味養成 |
| The Concept of Taste | https://www.raphaelsalaja.com/library/the-concept-of-taste | 美學品味探討 |
| You Don't Need Animations | https://emilkowal.ski/ui/you-dont-need-animations | 動畫的適當使用 |
| Using AI as a Design Engineer | https://jakub.kr/work/using-ai-as-a-design-engineer | 用 AI 做設計工程的實踐 |
| Design Books | https://designbooks.org/ | 產品／互動設計策展書單 |

---

**用法建議**：做網站要「美美的」風格時，把上半部「原則規範類」6 條連結＋1～2 個 agent skill（Taste Skill／Impeccable／UI Skills）丟給 AI 當守則，再指定下半部某個元件庫（如 Magic UI／Fancy Components）當視覺基調，效果最好。求職職缺類已濾除。
