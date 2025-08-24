import { ComponentChildren } from "preact";
import { memo } from "preact/compat";
import AbstractBulkAction from "./abstract_bulk_action";

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
            <td className="button-column">
                {helpText && <div className="dropdown help-dropdown">
                    <span className="bx bx-help-circle icon-action" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></span>
                    <div className="dropdown-menu dropdown-menu-right p-4">
                        {helpText}
                    </div>
                </div>}

                <span
                    className="bx bx-x icon-action action-conf-del"
                    onClick={() => bulkAction?.deleteAction()}
                />
            </td>
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