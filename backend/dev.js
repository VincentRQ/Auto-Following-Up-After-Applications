import { spawn } from "node:child_process";

const children = [
  spawn(process.execPath, ["backend/server.js"], { stdio: "inherit" }),
  process.platform === "win32"
    ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm run dev"], { stdio: "inherit", windowsHide: true })
    : spawn("npm", ["run", "dev"], { stdio: "inherit" }),
];

function stop() {
  for (const child of children) child.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) child.on("exit", (code) => {
  if (code && code !== 0) process.exitCode = code;
});
