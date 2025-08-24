import { ActionKeyboardShortcut, KeyboardActionNames } from "@triliumnext/commons";
import { useEffect, useState } from "preact/hooks";
import keyboard_actions from "../../services/keyboard_actions";

interface KeyboardShortcutProps {
    actionName: KeyboardActionNames;
}

export default function KeyboardShortcut({ actionName }: KeyboardShortcutProps) {

    const [ action, setAction ] = useState<ActionKeyboardShortcut>();
    useEffect(() => {
        keyboard_actions.getAction(actionName).then(setAction);
    }, []);

    if (!action) {
        return <></>;
    }

    return (
        <>
            {action.effectiveShortcuts?.map((shortcut, i) => {
                const keys = shortcut.split("+");
                return keys
                    .map((key, i) => (
                        <>
                            <kbd>{key}</kbd> {i + 1 < keys.length && "+ "}
                        </>
                    ))
            }).reduce<any>((acc, item) => (acc.length ? [...acc, ", ", item] : [item]), [])}
        </>
    );
}