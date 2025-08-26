import { OptionNames } from "@triliumnext/commons";
import { OptionValue } from "./options.js";
import options from "./options.js";
import utils from "./utils.js";

class LocalOptions {
    private arr!: Record<string, OptionValue>;
    private index: string[] = [];

    constructor() {
        this.setup();
    }

    private async setup() {
        // Electron cant save in local storage
        if (utils.isElectron())
            return;

        // Load data
        await options.initializedPromise;
        if (localStorage) {
            const index = localStorage.getItem("options-index");
            if (index) {
                // Load index
                const data: Record<string, OptionValue> = {};
                for (const val of JSON.parse(index)) {
                    if (val) {
                        const eVal = localStorage.getItem("options-entry-" + val);
                        if (eVal) {
                            data[val] = eVal;
                            this.index.push(val);
                        }
                    }
                }

                // Load data
                this.load(data);
            } else {
                // Initialize
                this.arr = {};
                localStorage.setItem("options-index", "[]");
            }
        }
    }

    has(key: string) {
        return this.index.includes(key);
    }

    hasLocal(key: string) {
        return this.index.includes(key);
    }

    load(arr: Record<string, OptionValue>) {
        if (utils.isElectron())
            return;
        this.arr = arr;
    }

    get(key: string) {
        if (utils.isElectron())
            return options.get(key);
        if (!this.isAllowedLocal(key) || (!this.isEmptyDefault(key) && !this.has(key)))
            return options.get(key);
        return this.arr?.[key] as string;
    }

    getNames() {
        if (utils.isElectron())
            return options.getNames();
        const keys = Object.keys(this.arr || []);
        for (const key in options.getNames()) {
            if (!keys.includes(key))
                keys.push(key);
        }
        return keys;
    }

    getJson(key: string) {
        if (utils.isElectron())
            return options.getJson(key);
        if (!this.isAllowedLocal(key) || (!this.isEmptyDefault(key) && !this.has(key)))
            return options.getJson(key);
        const value = this.arr?.[key];
        if (typeof value !== "string") {
            return null;
        }
        try {
            return JSON.parse(value);
        } catch (e) {
            return null;
        }
    }

    getInt(key: string) {
        if (utils.isElectron())
            return options.getInt(key);
        if (!this.isAllowedLocal(key) || (!this.isEmptyDefault(key) && !this.has(key)))
            return options.getInt(key);
        const value = this.arr?.[key];
        if (typeof value === "number") {
            return value;
        }
        if (typeof value == "string") {
            return parseInt(value);
        }
        console.warn("Attempting to read int for unsupported value: ", value);
        return null;
    }

    getFloat(key: string) {
        if (utils.isElectron())
            return options.getFloat(key);
        if (!this.isAllowedLocal(key) || (!this.isEmptyDefault(key) && !this.has(key)))
            return options.getFloat(key);
        const value = this.arr?.[key];
        if (typeof value !== "string") {
            return null;
        }
        return parseFloat(value);
    }

    is(key: string) {
        if (utils.isElectron())
            return options.is(key);
        if (!this.isAllowedLocal(key) || (!this.isEmptyDefault(key) && !this.has(key)))
            return options.is(key);
        return this.arr[key] === "true";
    }

    set(key: string, value: OptionValue) {
        if (utils.isElectron())
            return options.set(key, value);
        if (!this.isAllowedLocal(key))
            return options.set(key, value);
        this.arr[key] = value;
    }

    remove(key: string) {
        if (!this.hasLocal(key))
            return;

        // Remove
        delete this.arr[key];
        localStorage.removeItem("options-entry-" + key);

        // Save entries
        const newIndex: string[] = [];
        for (const key in this.arr) {
            newIndex.push(key);
        }
        localStorage.setItem("options-index", JSON.stringify(newIndex));
        this.index = newIndex;
    }

    async save(key: string, value: OptionValue) {
        if (utils.isElectron())
            return options.save(key, value);
        if (!this.isAllowedLocal(key))
            return options.save(key, value);
        this.set(key, value);

        const payload: Record<string, OptionValue> = {};
        payload[key] = value;

        // Save entries
        const newIndex: string[] = [];
        localStorage.setItem("options-entry-" + key, value.toString());
        for (const key in this.arr) {
            newIndex.push(key);
        }
        localStorage.setItem("options-index", JSON.stringify(newIndex));
        this.index = newIndex;
    }

    /**
     * Saves multiple options at once, by supplying a record where the keys are the option names and the values represent the stringified value to set.
     * @param newValues the record of keys and values.
     */
    async saveMany<T extends OptionNames>(newValues: Record<T, OptionValue>) {
        if (utils.isElectron())
            return options.saveMany(newValues);

        // Save entries
        let hasNonLocal = false;
        const remain: Record<string, OptionValue> = {};
        const newIndex: string[] = [];
        for (const key in newValues) {
            if (!this.isAllowedLocal(key)) {
                remain[key] = newValues[key];
                hasNonLocal = true;
                continue;
            }
            this.set(key, newValues[key]);
            newIndex.push(key);
            localStorage.setItem("options-entry-" + key, newValues[key].toString());
        }
        localStorage.setItem("options-index", JSON.stringify(newIndex));
        this.index = newIndex;
        if (hasNonLocal)
            await options.saveMany(remain);
        return;
    }

    async toggle(key: string) {
        if (utils.isElectron())
            return options.toggle(key);
        if (!this.isAllowedLocal(key))
            return options.toggle(key);
        await this.save(key, (!this.is(key)).toString());
    }

    isAllowedLocal(name: string) {
        return ((OPTIONS_ALLOWED_LOCAL as Set<string>).has(name) // FIXME: the options below depend too much on the server right now, nor have we fully implemented user-specific options
            // || name.startsWith("keyboardShortcuts")
            // || name.endsWith("Collapsed")
            // || name.startsWith("hideArchivedNotes")
        ) && options.is("useLocalOption_" + name)
    }

    private isEmptyDefault(name: string) {
        return (OPTIONS_LOCAL_EMPTY_DEFAULT as Set<string>).has(name)
    }
}

// options permitted to be local options instead of server options
const OPTIONS_ALLOWED_LOCAL = new Set<OptionNames>([
    "openNoteContexts",
    "noteTreeExpansion"
]);

// options that are empty by default instead of using the server options as fallback
const OPTIONS_LOCAL_EMPTY_DEFAULT = new Set<OptionNames>([
    "openNoteContexts",
    "noteTreeExpansion"
]);

const localOptions = new LocalOptions();

export default localOptions;
