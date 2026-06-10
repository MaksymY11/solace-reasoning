import { parseCitations } from "../parseCitations";

describe("parseCitations", () => {
    it("parses a standard Name | URL citation line", () => {
        const result = parseCitations("This is an answer.", "Source 1 | https://example.com");

        expect(result.cleanedText).toBe("This is an answer.");
        expect(result.citations).toEqual([
            { name: "Source 1", url: "https://example.com" },
        ]);
    });

    it("parses multiple citation lines", () => {
        const result = parseCitations(
            "Multiple citations are referenced.",
            "Source A | https://a.example.com\nSource B | https://b.example.com"
        );

        expect(result.cleanedText).toBe("Multiple citations are referenced.");
        expect(result.citations).toEqual([
            { name: "Source A", url: "https://a.example.com" },
            { name: "Source B", url: "https://b.example.com" },
        ]);
    });

    it("ignores malformed citation lines with missing URL or missing pipe", () => {
        const result = parseCitations(
            "Malformed citations should be skipped.",
            "Bad line without pipe\nNo URL | not-a-url\nGood Source | https://good.example.com"
        );

        expect(result.citations).toEqual([
            { name: "Good Source", url: "https://good.example.com" },
        ]);
    });

    it("returns no citations for an empty citation section", () => {
        const result = parseCitations("No citations here.", "");

        expect(result.cleanedText).toBe("No citations here.");
        expect(result.citations).toEqual([]);
    });

    it("cleans markdown links and extra formatting from answer text", () => {
        const result = parseCitations(
            "See [the source](https://example.com) for details. 【Bing】\n\n\nExtra   spaces .",
            "Source | https://example.com"
        );

        expect(result.cleanedText).toBe("See the source for details. \n\nExtra spaces.");
        expect(result.citations).toEqual([{ name: "Source", url: "https://example.com" }]);
    });

    it("handles a missing citationsSection gracefully", () => {
        const result = parseCitations("Answer without citations section.");

        expect(result.cleanedText).toBe("Answer without citations section.");
        expect(result.citations).toEqual([]);
    });
});
