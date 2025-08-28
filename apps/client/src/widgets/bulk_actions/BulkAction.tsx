import { ComponentChildren } from "preact";
import { memo } from "preact/compat";
import AbstractBulkAction from "./abstract_bulk_action";
import HelpRemoveButtons from "../react/HelpRemoveButtons";

interface BulkActionProps {
    label: string | ComponentChildren;   
    children?: ComponentChildren;
    helpText?: ComponentChildren;
    bulkAction: AbstractBulkAction;
}

// Define styles as constants to prevent recreation
const flexContainerStyle = { display: "flex", alignItems: "center" } as const;
const labelStyle = { marginRight: "10px" } as const;
const textStyle = { marginRight: "10px", marginLeft: "10px" } as const;

const BulkAction = memo(({ label, children, helpText, bulkAction }: BulkActionProps) => {
    return (
        <tr>
            <td colSpan={2}>
                <div style={flexContainerStyle}>
                    <div style={labelStyle} className="text-nowrap">{label}</div>

                    {children}
                </div>
            </td>
            <HelpRemoveButtons
                help={helpText}
                removeText="Delete"
                onRemove={() => bulkAction?.deleteAction()}
            />
        </tr>
    );
});

export default BulkAction;

export const BulkActionText = memo(({ text }: { text: string }) => {
    return (
        <div
            style={textStyle}
            className="text-nowrap">
                {text}
            </div>
    );
});