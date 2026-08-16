export async function probe() {
  return {
    status: "ready",
    summary: "Built-in local rule-tool adapter is available.",
    capabilities: ["execution", "verification"]
  };
}

export async function prepare({ operation }) {
  return {
    status: "prepared",
    executed: false,
    operation: operation ?? null
  };
}
