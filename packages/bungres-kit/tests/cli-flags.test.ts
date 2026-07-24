import { describe, expect, test } from "bun:test";
import { parseFlags } from "../src/cli.js";

describe("CLI parseFlags", () => {
  test("parses long flags correctly", () => {
    const flags = parseFlags(["--config", "my-config.ts", "--verbose", "--yes"]);
    expect(flags.config).toBe("my-config.ts");
    expect(flags.verbose).toBe(true);
    expect(flags.yes).toBe(true);
  });

  test("parses short flag aliases correctly", () => {
    const flags = parseFlags(["-c", "custom.ts", "-v", "-y", "-f"]);
    expect(flags.config).toBe("custom.ts");
    expect(flags.verbose).toBe(true);
    expect(flags.yes).toBe(true);
    expect(flags.force).toBe(true);
  });

  test("handles empty or positional args without errors", () => {
    const flags = parseFlags([]);
    expect(Object.keys(flags).length).toBe(0);
  });
});
