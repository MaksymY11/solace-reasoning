import { StreamParser } from "../streamParser";

describe("StreamParser", () => {
    it("handles section headers split across multiple chunks", () => {
        const parser = new StreamParser();
        const first = parser.accept("[Researching");
        expect(first).toEqual([]);

        const second = parser.accept(" sources...]Found some data.");
        expect(second).toEqual([
            { type: "section", section: "Researching sources..." },
            { type: "content", text: "Found some data.", section: "Researching sources..." },
        ]);
    });

    it("handles multiple section headers in a single chunk", () => {
        const parser = new StreamParser();
        const events = parser.accept("[Researching sources...][Applying to your situation...]Then answer.");

        expect(events).toEqual([
            { type: "section", section: "Researching sources..." },
            { type: "section", section: "Applying to your situation..." },
            { type: "content", text: "Then answer.", section: "Applying to your situation..." },
        ]);
    });

    it("does not treat regular bracketed text as section headers", () => {
        const parser = new StreamParser();
        const events = parser.accept("Refer to [Form I-485] for details.");

        expect(events).toEqual([
            { type: "content", text: "Refer to ", section: undefined },
            { type: "content", text: "[Form I-485]", section: undefined },
            { type: "content", text: " for details.", section: undefined },
        ]);
        expect(parser.getCurrentSection()).toBeUndefined();
    });

    it("flushes content before a new section under the old section", () => {
        const parser = new StreamParser();
        const first = parser.accept("[Section A...]First part of A ");
        expect(first).toEqual([
            { type: "section", section: "Section A..." },
            { type: "content", text: "First part of A ", section: "Section A..." },
        ]);

        const second = parser.accept("continuing A[Section B...]Start of B");
        expect(second).toEqual([
            { type: "content", text: "continuing A", section: "Section A..." },
            { type: "section", section: "Section B..." },
            { type: "content", text: "Start of B", section: "Section B..." },
        ]);
    });

    it("ignores empty deltas and returns no events", () => {
        const parser = new StreamParser();
        expect(parser.accept("")).toEqual([]);
        expect(parser.accept("")).toEqual([]);
    });

    it("flushes remaining buffered text at end of stream", () => {
        const parser = new StreamParser();
        parser.accept("[Section A...]Some text before [incomp");

        expect(parser.flush()).toEqual([
            { type: "content", text: "[incomp", section: "Section A..." },
        ]);
        expect(parser.flush()).toEqual([]);
    });

    it("parses a realistic multi-chunk agent response sequence", () => {
        const parser = new StreamParser();

        const chunk1 = parser.accept("[Researching sources...]The agent is gathering information about ");
        expect(chunk1).toEqual([
            { type: "section", section: "Researching sources..." },
            { type: "content", text: "The agent is gathering information about ", section: "Researching sources..." },
        ]);

        const chunk2 = parser.accept("immigration forms like [Form I-485] and then [Applying to your situation...]it begins tailoring advice.");
        expect(chunk2).toEqual([
            { type: "content", text: "immigration forms like ", section: "Researching sources..." },
            { type: "content", text: "[Form I-485]", section: "Researching sources..." },
            { type: "content", text: " and then ", section: "Researching sources..." },
            { type: "section", section: "Applying to your situation..." },
            { type: "content", text: "it begins tailoring advice.", section: "Applying to your situation..." },
        ]);
    });
});
