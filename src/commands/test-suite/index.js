export function handleIntegratedTestCommand(content, context = {}) {
  const parts = String(content || "").trim().split(/\s+/);
  const rawCommand = parts[0];
  const prefix = context.prefix || "!";
  const command = rawCommand.startsWith("+")
    ? rawCommand.slice(1)
    : rawCommand.startsWith(prefix)
      ? rawCommand.slice(prefix.length)
      : rawCommand;

  if (!context.isAdmin) {
    return ["groupstatus", "adminlist"].includes(command)
      ? { error: "Bạn không có quyền dùng lệnh quản trị." }
      : null;
  }

  switch (command) {
    case "groupstatus":
      return {
        command: "+groupstatus",
        threadId: context.threadId || null,
        memberCount: Number(context.memberCount || 0),
        prefix,
        isAdmin: true,
        checkedAt: new Date().toISOString(),
      };
    case "adminlist":
      return {
        command: "+adminlist",
        count: Array.isArray(context.admins) ? context.admins.length : 0,
        admins: Array.isArray(context.admins) ? context.admins : [],
      };
    default:
      return null;
  }
}

export const simulationTool = {
  name: "simulation",
  description: "Run local, non-destructive bot simulations.",
  commands: [],
  run(command, args = [], context = {}) {
    const input = [command, ...args].filter((value) => value !== undefined && value !== null).join(" ");
    return handleIntegratedTestCommand(input, context);
  },
};
