
import * as fs from "fs";
import * as path from "path";

const SESSION_FILE = path.resolve(__dirname, "../.auth_session");

export function loadAuthSession(): string | null {
  if (fs.existsSync(SESSION_FILE)) {
    return fs.readFileSync(SESSION_FILE, "utf-8").trim();
  }
  return null;
}

export function saveAuthSession(token: string): void {
  fs.writeFileSync(SESSION_FILE, token, { encoding: "utf-8" });
}
