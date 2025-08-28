import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { EventData, EventNames } from "../../components/app_context";
import { ParentComponent } from "./ReactBasicWidget";
import SpacedUpdate from "../../services/spaced_update";
import { OptionNames } from "@triliumnext/commons";
import options, { type OptionValue } from "../../services/options";
import local_options from "../../services/local_options";
import utils, { reloadFrontendApp } from "../../services/utils";
import Component from "../../components/component";
import { t } from "../../services/i18n";
import Button from "./Button";

type TriliumEventHandler<T extends EventNames> = (data: EventData<T>) => void;
const registeredHandlers: Map<Component, Map<EventNames, TriliumEventHandler<any>[]>> = new Map();

/**
 * Allows a React component to react to Trilium events (e.g. `entitiesReloaded`). When the desired event is triggered, the handler is invoked with the event parameters.
 * 
 * Under the hood, it works by altering the parent (Trilium) component of the React element to introduce the corresponding event.
 * 
 * @param eventName the name of the Trilium event to listen for.
 * @param handler the handler to be invoked when the event is triggered.
 * @param enabled determines whether the event should be listened to or not. Useful to conditionally limit the listener based on a state (e.g. a modal being displayed).
 */
export default function useTriliumEvent<T extends EventNames>(eventName: T, handler: TriliumEventHandler<T>, enabled = true) {
    const parentWidget = useContext(ParentComponent);
    if (!parentWidget) {
        return;
    }

    const handlerName = `${eventName}Event`;
    const customHandler = useMemo(() => {
        return async (data: EventData<T>) => {
            // Inform the attached event listeners.
            const eventHandlers = registeredHandlers.get(parentWidget)?.get(eventName) ?? [];
            for (const eventHandler of eventHandlers) {
                eventHandler(data);
            }
        }
    }, [eventName, parentWidget]);

    useEffect(() => {
        // Attach to the list of handlers.
        let handlersByWidget = registeredHandlers.get(parentWidget);
        if (!handlersByWidget) {
            handlersByWidget = new Map();
            registeredHandlers.set(parentWidget, handlersByWidget);
        }

        let handlersByWidgetAndEventName = handlersByWidget.get(eventName);
        if (!handlersByWidgetAndEventName) {
            handlersByWidgetAndEventName = [];
            handlersByWidget.set(eventName, handlersByWidgetAndEventName);
        }

        if (!handlersByWidgetAndEventName.includes(handler)) {
            handlersByWidgetAndEventName.push(handler);
        }

        // Apply the custom event handler.
        if (parentWidget[handlerName] && parentWidget[handlerName] !== customHandler) {
            console.warn(`Widget ${parentWidget.componentId} already had an event listener and it was replaced by the React one.`);
        }

        parentWidget[handlerName] = customHandler;

        return () => {
            const eventHandlers = registeredHandlers.get(parentWidget)?.get(eventName);
            if (!eventHandlers || !eventHandlers.includes(handler)) {
                return;
            }

            // Remove the event handler from the array.            
            const newEventHandlers = eventHandlers.filter(e => e !== handler);
            if (newEventHandlers.length) {
                registeredHandlers.get(parentWidget)?.set(eventName, newEventHandlers);
            } else {
                registeredHandlers.get(parentWidget)?.delete(eventName);
            }

            if (!registeredHandlers.get(parentWidget)?.size) {
                registeredHandlers.delete(parentWidget);
            }
        };
    }, [eventName, parentWidget, handler]);
}

export function useSpacedUpdate(callback: () => Promise<void>, interval = 1000) {
    const callbackRef = useRef(callback);
    const spacedUpdateRef = useRef<SpacedUpdate>();

    // Update callback ref when it changes
    useEffect(() => {
        callbackRef.current = callback;
    });

    // Create SpacedUpdate instance only once
    if (!spacedUpdateRef.current) {
        spacedUpdateRef.current = new SpacedUpdate(
            () => callbackRef.current(),
            interval
        );
    }

    // Update interval if it changes
    useEffect(() => {
        spacedUpdateRef.current?.setUpdateInterval(interval);
    }, [interval]);

    return spacedUpdateRef.current;
}

/**
 * Allows a React component to read and write a Trilium option, while also watching for external changes.
 * 
 * Conceptually, `useTriliumOption` works just like `useState`, but the value is also automatically updated if
 * the option is changed somewhere else in the client.
 * 
 * @param name the name of the option to listen for.
 * @param needsRefresh whether to reload the frontend whenever the value is changed.
 * @returns an array where the first value is the current option value and the second value is the setter.
 */
export function useTriliumOption(name: OptionNames, useServerSided: boolean, needsRefresh?: boolean): [string, (newValue: OptionValue) => Promise<void>, (() => boolean)?, (() => Promise<void>)?] {
    const options_framework = useServerSided ? options : local_options;
    const initialValue = options_framework.get(name);
    const [value, setValue] = useState(initialValue);

    const wrappedSetValue = useMemo(() => {
        return async (newValue: OptionValue) => {
            await options_framework.save(name, newValue);

            if (needsRefresh) {
                reloadFrontendApp(`option change: ${name}`);
            }

            if (!useServerSided && local_options.hasLocal(name) && local_options.isAllowedLocal(name))
                setValue(newValue.toString());
        }
    }, [name, needsRefresh]);

    useTriliumEvent("entitiesReloaded", useCallback(({ loadResults }) => {
        if (loadResults.getOptionNames().includes(name)) {
            const newValue = options.get(name);
            setValue(newValue);
        }
    }, [name]));
    useTriliumEvent("localOptionsChanged", useCallback(({ updatedOptions }) => {
        if (updatedOptions.includes(name)) {
            const newValue = local_options.get(name);
            setValue(newValue);
        }
    }, [name]));
    const isDefinedClientsided = useServerSided ? undefined : function () {
        // Check
        return local_options.hasLocal(name) && local_options.isAllowedLocal(name);
    };

    const removeClientsided = useServerSided ? undefined : async function () {
        // Remove
        await local_options.remove(name);

        if (needsRefresh) {
            reloadFrontendApp(`option change: ${name}`);
        }

        return;
    };

    return [
        value,
        wrappedSetValue,
        isDefinedClientsided,
        removeClientsided
    ]
}

/**
 * Similar to {@link useTriliumOption}, but the value is converted to and from a boolean instead of a string.
 * 
 * @param useServerSided true to use server-sided options, false to use local
 * @param name the name of the option to listen for
 * @param needsRefresh whether to reload the frontend whenever the value is changed
 * @returns an array where the first value is the current option value and the second value is the setter.
 */
export function useTriliumOptionBool(name: OptionNames, useServerSided: boolean, needsRefresh?: boolean): [boolean, (newValue: boolean) => Promise<void>, (() => boolean)?, (() => Promise<void>)?] {
    const [value, setValue, isDefinedClientsided, removeClientsided] = useTriliumOption(name, useServerSided, needsRefresh);
    return [
        (value === "true"),
        (newValue) => setValue(newValue ? "true" : "false"),
        isDefinedClientsided,
        removeClientsided
    ]
}

/**
 * Similar to {@link useTriliumOption}, but the value is converted to and from a int instead of a string.
 * 
 * @param useServerSided true to use server-sided options, false to use local
 * @param name the name of the option to listen for
 * @param needsRefresh whether to reload the frontend whenever the value is changed
 * @returns an array where the first value is the current option value and the second value is the setter.
 */
export function useTriliumOptionInt(name: OptionNames, useServerSided: boolean, needsRefresh?: boolean): [number, (newValue: number) => Promise<void>, (() => boolean)?, (() => Promise<void>)?] {
    const [value, setValue, isDefinedClientsided, removeClientsided] = useTriliumOption(name, useServerSided, needsRefresh);
    return [
        (parseInt(value, 10)),
        (newValue) => setValue(newValue),
        isDefinedClientsided,
        removeClientsided
    ]
}

/**
 * Similar to {@link useTriliumOption}, but the object value is parsed to and from a JSON instead of a string.
 * 
 * @param useServerSided true to use server-sided options, false to use local
 * @param name the name of the option to listen for
 * @param needsRefresh whether to reload the frontend whenever the value is changed
 * @returns an array where the first value is the current option value and the second value is the setter.
 */
export function useTriliumOptionJson<T>(name: OptionNames, useServerSided: boolean, needsRefresh?: boolean): [T, (newValue: T) => Promise<void>, (() => boolean)?, (() => Promise<void>)?] {
    const [value, setValue, isDefinedClientsided, removeClientsided] = useTriliumOption(name, useServerSided, needsRefresh);
    return [
        (JSON.parse(value) as T),
        (newValue => setValue(JSON.stringify(newValue))),
        isDefinedClientsided,
        removeClientsided
    ];
}

/**
 * Similar to {@link useTriliumOption}, but operates with multiple options at once. 
 * 
 * @param useServerSided true to use server-sided options, false to use local
 * @param names the name of the option to listen for.
 * @returns an array where the first value is a map where the keys are the option names and the values, and the second value is the setter which takes in the same type of map and saves them all at once.
 */
export function useTriliumOptions<T extends OptionNames>(useServerSided: boolean, ...names: T[]) {
    const options_framework = useServerSided ? options : local_options;
    const values: Record<string, string> = {};
    for (const name of names) {
        values[name] = options_framework.get(name);
    }

    const isDefinedClientsided = useServerSided ? undefined : function (name) {
        // Check
        return local_options.hasLocal(name);
    };

    const removeClientsided = useServerSided ? undefined : async function (name) {
        // Remove
        await local_options.remove(name);
        return;
    };

    return [
        values as Record<T, string>,
        options_framework.saveMany,
        isDefinedClientsided,
        removeClientsided
    ] as const;
}

type AutoSidedHandlerContext = { supportsLocal: boolean, isLocal: boolean, hasLocalValue: boolean, resetLocalValue: () => Promise<void>, switchToOtherSide: () => Promise<void>, genSideAwareElements?: (prefixElemGenerator: () => any) => any };
type AutoSidedHandler<T, T2> = (value: T2, setValue: (newValue: T2) => Promise<void>, execContext: AutoSidedHandlerContext) => T;

/**
 * Used to insert option blocks with support for local and server sided fields, see eg. appearance.tsx for examples
 * 
 * @param name option name
 * @param handler option content provider
 * @param setValueHandler optional handler for setValue calls
 * @param needsRefresh whether to reload the frontend whenever the value is changed
 * @returns object elements
 */
export function triliumSideAwareOptionInserter<T>(name: OptionNames, handler: AutoSidedHandler<T, string>, setValueHandler?: (setValueUpstream: (newValue: OptionValue) => Promise<void>, newValue: OptionValue) => Promise<void>, needsRefresh?: boolean): T {
    const [sideState, setSideState] = useState<boolean>(true);

    function stateForSide(useLocal: boolean) {
        let options_framework = useLocal ? local_options : options;

        const initialValue = options_framework.get(name);
        const [value, setValue] = useState(initialValue);
        const [localPresent, setLocalPresent] = useState(local_options.hasLocal(name));

        useTriliumEvent("entitiesReloaded", useCallback(({ loadResults }) => {
            if (loadResults.getOptionNames().includes(name)) {
                const newValue = options.get(name);
                setValue(newValue);
            }
        }, [name]));
        useTriliumEvent("localOptionsChanged", useCallback(({ updatedOptions }) => {
            if (updatedOptions.includes(name)) {
                const newValue = local_options.get(name);
                setValue(newValue);
            }
        }, [name]));

        const ctx: AutoSidedHandlerContext = {
            supportsLocal: local_options.isAllowedLocal(name),
            hasLocalValue: localPresent,
            isLocal: useLocal,
            resetLocalValue: async function () {
                // Remove
                local_options.remove(name);

                // Refresh if needed
                if (needsRefresh) {
                    reloadFrontendApp(`option change: ${name}`);
                }

                setValue(options.get(name));
                setLocalPresent(false);
            },
            switchToOtherSide: async function () {
                // Switch
                setSideState(!useLocal);
                setValue((!useLocal ? local_options : options).get(name))
            },
            genSideAwareElements: function (prefixElemGenerator?: () => any) {
                return (
                    <>
                        {ctx.supportsLocal &&
                            <p>
                                { prefixElemGenerator && prefixElemGenerator() }
                                {ctx.isLocal && ctx.hasLocalValue &&
                                    <Button
                                        size="micro" icon="bx bx-eraser"
                                        text={t("local_options.reset_option")}
                                        onClick={ctx.resetLocalValue}
                                    />
                                }
                                <Button
                                    size="micro" icon={ctx.isLocal ? "bx bx-terminal" : "bx bx-window"}
                                    text={ctx.isLocal ? t("local_options.switch_server") : t("local_options.switch_client")}
                                    onClick={ctx.switchToOtherSide}
                                />
                            </p>
                        }
                    </>
                )
            }
        };
        if (utils.isElectron()) {
            ctx.supportsLocal = false;
            ctx.hasLocalValue = false;
            ctx.isLocal = false;
            options_framework = options;
        }
        return {
            ctx: ctx,
            handler: () => {
                return handler(value, async (val) => {
                    const upstream = async (val) => {
                        await options_framework.save(name, val);

                        if (needsRefresh) {
                            reloadFrontendApp(`option change: ${name}`);
                        }

                        setValue(val);
                        if (ctx.isLocal)
                            setLocalPresent(true);
                    };
                    if (!setValueHandler)
                        upstream(val);
                    else
                        setValueHandler(upstream, val);
                }, ctx);
            }
        };
    }
    return stateForSide(sideState).handler();
}

/**
 * Similar to {@link triliumSideAwareOptionInserter}, but the value is converted to and from a boolean instead of a string.
 * 
 * @param name option name
 * @param handler option content provider
 * @param setValueHandler optional handler for setValue calls
 * @param needsRefresh whether to reload the frontend whenever the value is changed
 * @returns object elements
 */
export function triliumSideAwareOptionBoolInserter<T>(name: OptionNames, handler: AutoSidedHandler<T, boolean>, setValueHandler?: (setValueUpstream: (newValue: boolean) => Promise<void>, newValue: boolean) => Promise<void>, needsRefresh?: boolean): T {
    return triliumSideAwareOptionInserter(name, (value, setValue, ctx) => { 
        return handler((value === "true"), (newValue) => {
            // Assign value
            const upstream = (newValue: boolean) => {
                return setValue(newValue ? "true" : "false");
            };
            if (!setValueHandler)
                return upstream(newValue);
            else
                return setValueHandler(upstream, newValue);
        }, ctx);
    }, undefined, needsRefresh);
}

/**
 * Similar to {@link triliumSideAwareOptionInserter}, but the value is converted to and from a int instead of a string.
 * 
 * @param name option name
 * @param handler option content provider
 * @param setValueHandler optional handler for setValue calls
 * @param needsRefresh whether to reload the frontend whenever the value is changed
 * @returns object elements
 */
export function triliumSideAwareOptionIntInserter<T>(name: OptionNames, handler: AutoSidedHandler<T, number>, setValueHandler?: (setValueUpstream: (newValue: number) => Promise<void>, newValue: number) => Promise<void>, needsRefresh?: boolean): T {
    return triliumSideAwareOptionInserter(name, (value, setValue, ctx) => { 
        return handler(parseInt(value, 10), (newValue) => {
            // Assign value
            const upstream = (newValue: number) => {
                return setValue(newValue.toString());
            };
            if (!setValueHandler)
                return upstream(newValue);
            else
                return setValueHandler(upstream, newValue);
        }, ctx);
    }, undefined, needsRefresh);
}

/**
 * Similar to {@link triliumSideAwareOptionInserter}, but the object value is parsed to and from a JSON instead of a string.
 * 
 * @param name option name
 * @param handler option content provider
 * @param setValueHandler optional handler for setValue calls
 * @param needsRefresh whether to reload the frontend whenever the value is changed
 * @returns object elements
 */
export function triliumSideAwareOptionJsonInserter<T, T2>(name: OptionNames, handler: AutoSidedHandler<T, T2>, setValueHandler?: (setValueUpstream: (newValue: T2) => Promise<void>, newValue: T2) => Promise<void>, needsRefresh?: boolean): T {
    return triliumSideAwareOptionInserter(name, (value, setValue, ctx) => { 
        return handler(JSON.parse(value) as T2, (newValue) => {
            // Assign value
            const upstream = (newValue: T2) => {
                return setValue(JSON.stringify(newValue));
            };
            if (!setValueHandler)
                return upstream(newValue);
            else
                return setValueHandler(upstream, newValue);
        }, ctx);
    }, undefined, needsRefresh);
}

/**
 * Generates a unique name via a random alphanumeric string of a fixed length.
 * 
 * <p>
 * Generally used to assign names to inputs that are unique, especially useful for widgets inside tabs.
 * 
 * @param prefix a prefix to add to the unique name.
 * @returns a name with the given prefix and a random alpanumeric string appended to it.
 */
export function useUniqueName(prefix?: string) {
    return useMemo(() => (prefix ? prefix + "-" : "") + utils.randomString(10), [prefix]);
}
