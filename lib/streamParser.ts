export type StreamParserEvent =
    | { type: "content"; text: string; section?: string }
    | { type: "section"; section: string };

const SECTION_HEADER_REGEX = /\[[^\]]+\.\.\.\]/;

export class StreamParser {
    private buffer = "";
    private currentSection: string | undefined;

    getCurrentSection(): string | undefined {
        return this.currentSection;
    }

    accept(delta: string): StreamParserEvent[] {
        this.buffer += delta;
        const events: StreamParserEvent[] = [];

        while (true) {
            const openIndex = this.buffer.indexOf("[");

            if (openIndex === -1) {
                if (this.buffer.length > 0) {
                    events.push({
                        type: "content",
                        text: this.buffer,
                        section: this.currentSection,
                    });
                    this.buffer = "";
                }
                break;
            }

            if (openIndex > 0) {
                const leadingText = this.buffer.slice(0, openIndex);
                events.push({
                    type: "content",
                    text: leadingText,
                    section: this.currentSection,
                });
                this.buffer = this.buffer.slice(openIndex);
            }

            const closeIndex = this.buffer.indexOf("]");
            if (closeIndex === -1) {
                // Incomplete header; keep partial bracket for the next delta.
                break;
            }

            const candidate = this.buffer.slice(0, closeIndex + 1);
            if (SECTION_HEADER_REGEX.test(candidate)) {
                this.buffer = this.buffer.slice(closeIndex + 1);
                const sectionName = candidate.slice(1, -1);
                if (sectionName !== this.currentSection) {
                    this.currentSection = sectionName;
                    events.push({ type: "section", section: sectionName });
                }
                continue;
            }

            // Not a section header, emit the bracketed text as regular content.
            events.push({
                type: "content",
                text: candidate,
                section: this.currentSection,
            });
            this.buffer = this.buffer.slice(closeIndex + 1);
        }

        return events;
    }

    flush(): StreamParserEvent[] {
        const events: StreamParserEvent[] = [];
        if (this.buffer.length > 0) {
            events.push({
                type: "content",
                text: this.buffer,
                section: this.currentSection,
            });
            this.buffer = "";
        }
        return events;
    }
}
