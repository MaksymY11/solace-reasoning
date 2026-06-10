import { detectDistress, sanitizeInput } from "../safety";

describe("detectDistress", () => {
    describe("domestic violence keywords", () => {
        it("detects 'beats me'", () => {
            const result = detectDistress("My partner beats me regularly");
            expect(result.isDistress).toBe(true);
            expect(result.resources.length).toBeGreaterThan(0);
        });

        it("detects 'being abused'", () => {
            const result = detectDistress("I think I'm being abused");
            expect(result.isDistress).toBe(true);
        });

        it("detects 'afraid for my life'", () => {
            const result = detectDistress("I'm afraid for my life");
            expect(result.isDistress).toBe(true);
        });
    });

    describe("self-harm keywords", () => {
        it("detects 'kill myself'", () => {
            const result = detectDistress("I want to kill myself");
            expect(result.isDistress).toBe(true);
        });

        it("detects 'suicidal'", () => {
            const result = detectDistress("I'm suicidal");
            expect(result.isDistress).toBe(true);
        });

        it("detects 'hurt myself'", () => {
            const result = detectDistress("I want to hurt myself");
            expect(result.isDistress).toBe(true);
        });
    });

    describe("trafficking keywords", () => {
        it("detects 'being trafficked'", () => {
            const result = detectDistress("I think I'm being trafficked");
            expect(result.isDistress).toBe(true);
        });
    });

    describe("detention/coercion keywords", () => {
        it("detects 'took my passport'", () => {
            const result = detectDistress("They took my passport");
            expect(result.isDistress).toBe(true);
        });

        it("detects 'forced to work'", () => {
            const result = detectDistress("I'm being forced to work");
            expect(result.isDistress).toBe(true);
        });
    });

    describe("case insensitivity", () => {
        it("detects uppercase keywords", () => {
            const result = detectDistress("MY PARTNER BEATS ME");
            expect(result.isDistress).toBe(true);
        });

        it("detects mixed case keywords", () => {
            const result = detectDistress("I'm BeInG AbUsEd");
            expect(result.isDistress).toBe(true);
        });

        it("detects lowercase keywords", () => {
            const result = detectDistress("i am suicidal");
            expect(result.isDistress).toBe(true);
        });
    });

    describe("normal immigration queries (no false positives)", () => {
        it("doesn't trigger on 'I want to kill my application'", () => {
            const result = detectDistress("I want to kill my application");
            expect(result.isDistress).toBe(false);
            expect(result.resources.length).toBe(0);
        });

        it("doesn't trigger on 'he will end my visa status'", () => {
            const result = detectDistress("They said he will end my visa status");
            expect(result.isDistress).toBe(false);
        });

        it("doesn't trigger on normal asylum inquiries", () => {
            const result = detectDistress("I'm applying for asylum protection under VAWA");
            expect(result.isDistress).toBe(false);
        });

        it("doesn't trigger on 'family violence exemption'", () => {
            const result = detectDistress("Can I apply for a family violence exemption?");
            expect(result.isDistress).toBe(false);
        });

        it("doesn't trigger on 'I'm concerned about my safety in my home country'", () => {
            const result = detectDistress("I'm concerned about my safety in my home country");
            expect(result.isDistress).toBe(false);
        });

        it("doesn't trigger on general immigration status questions", () => {
            const result = detectDistress("How long does it take to process an I-485 application?");
            expect(result.isDistress).toBe(false);
        });
    });

    describe("resource output", () => {
        it("returns appropriate crisis resources for distress detection", () => {
            const result = detectDistress("I'm being abused");
            expect(result.resources).toContain("- National DV Hotline: 1-800-799-7233");
            expect(result.resources).toContain("- Crisis Text Line: text HOME to 741741");
            expect(result.resources).toContain("- National Human Trafficking Hotline: 1-888-373-7888");
        });

        it("returns empty resources array for normal input", () => {
            const result = detectDistress("I need help with my visa application");
            expect(result.resources).toEqual([]);
        });

        it("returns same resources for any crisis keyword", () => {
            const dvResult = detectDistress("beats me");
            const selfHarmResult = detectDistress("suicidal");
            const traffickingResult = detectDistress("trafficking");

            expect(dvResult.resources).toEqual(selfHarmResult.resources);
            expect(selfHarmResult.resources).toEqual(traffickingResult.resources);
        });
    });
});

describe("sanitizeInput", () => {
    describe("control character removal", () => {
        it("removes null and delete characters", () => {
            const result = sanitizeInput("Hello\x00World\x7F");
            expect(result).toBe("HelloWorld");
        });

        it("removes multiple control characters", () => {
            const result = sanitizeInput("\x00Test\x07Input\x1F");
            expect(result).toBe("TestInput");
        });
    });

    describe("preserved whitespace characters", () => {
        it("preserves newlines and tabs within content", () => {
            const result = sanitizeInput("Line1\n\tIndented\nLine2");
            expect(result).toBe("Line1\n\tIndented\nLine2");
        });
    });

    describe("trimming", () => {
        it("trims leading and trailing whitespace", () => {
            const result = sanitizeInput("   Hello World   ");
            expect(result).toBe("Hello World");
        });

        it("trims newlines and tabs at boundaries", () => {
            const result = sanitizeInput("\n\t  Hello  \t\n");
            expect(result).toBe("Hello");
        });
    });

    describe("length truncation", () => {
        it("truncates input longer than 2000 characters", () => {
            const input = "a".repeat(2500);
            const result = sanitizeInput(input);
            expect(result).toHaveLength(2000);
            expect(result).toBe("a".repeat(2000));
        });

        it("doesn't truncate input exactly 2000 characters", () => {
            const input = "x".repeat(2000);
            const result = sanitizeInput(input);
            expect(result).toHaveLength(2000);
        });

        it("doesn't truncate input under 2000 characters", () => {
            const input = "y".repeat(1500);
            const result = sanitizeInput(input);
            expect(result).toHaveLength(1500);
        });

        it("truncates after control character removal", () => {
            const input = "a\x00".repeat(1500); // 2x3000 chars, becomes 1500 after control char removal
            const result = sanitizeInput(input);
            expect(result).toHaveLength(1500);
        });

        it("preserves newlines within 2000 char limit", () => {
            const input = "Line\nContent".repeat(100); // 1200 chars
            const result = sanitizeInput(input);
            expect(result).toContain("\n");
            expect(result?.includes("Line")).toBe(true);
            expect(result?.includes("Content")).toBe(true);
        });
    });

    describe("empty and null cases", () => {
        it("returns null for empty string", () => {
            expect(sanitizeInput("")).toBeNull();
        });

        it("returns null for whitespace-only string", () => {
            expect(sanitizeInput("   \n\t  ")).toBeNull();
        });
    });

    describe("combined scenarios", () => {
        it("removes control chars, trims, and respects length limit", () => {
            const input = "  \x00" + "a".repeat(2100) + "\x7F  ";
            const result = sanitizeInput(input);
            expect(result).toHaveLength(2000);
            expect(result?.startsWith("a")).toBe(true);
            expect(result?.endsWith("a")).toBe(true);
        });

        it("handles real-world user input with newlines and control chars", () => {
            const input = "\x00I need help\nMy situation:\x1F\n- Abused\n- Scared";
            const result = sanitizeInput(input);
            expect(result).toBe("I need help\nMy situation:\n- Abused\n- Scared");
        });

        it("sanitizes then detects distress in the same flow", () => {
            const userInput = "  \x00I'm suicidal\x7F  ";
            const sanitized = sanitizeInput(userInput);
            expect(sanitized).not.toBeNull();
            if (sanitized) {
                const distress = detectDistress(sanitized);
                expect(distress.isDistress).toBe(true);
            }
        });
    });

    describe("non-null return type", () => {
        it("returns a string for valid input", () => {
            expect(sanitizeInput("Valid input")).toBe("Valid input");
        });
    });
});
