import { describe, expect, test } from "bun:test";
import {
    parseGitOutputLines,
    parseGitStatusPorcelain,
    readGitOutput,
    readGitOutputLines,
} from "./git.ts";

describe("parseGitOutputLines", () => {
    test("trims and filters blank lines", () => {
        expect(parseGitOutputLines(" one\n\n two \n  \nthree\n")).toEqual([
            "one",
            "two",
            "three",
        ]);
    });
});

describe("readGitOutput", () => {
    test("returns trimmed command output", () => {
        const fake = { text: () => "  hello\n" };
        expect(readGitOutput(fake)).toBe("hello");
    });
});

describe("readGitOutputLines", () => {
    test("parses output into cleaned lines", () => {
        const fake = { text: () => " a\n\n b \n" };
        expect(readGitOutputLines(fake)).toEqual(["a", "b"]);
    });
});

describe("parseGitStatusPorcelain", () => {
    test("extracts modified and added file paths", () => {
        const output = " M src/main.ts\nA  README.md\nMM src/app.ts\n";
        expect(parseGitStatusPorcelain(output)).toEqual([
            "src/main.ts",
            "README.md",
            "src/app.ts",
        ]);
    });

    test("drops deleted entries", () => {
        const output = " D old-file.ts\nD  removed.ts\n";
        expect(parseGitStatusPorcelain(output)).toEqual([]);
    });

    test("returns rename target for renamed files", () => {
        const output = "R  src/old.ts -> src/new.ts\n";
        expect(parseGitStatusPorcelain(output)).toEqual(["src/new.ts"]);
    });
});
