interface FormTextAreaProps {
    id?: string;
    currentValue: string;
    onBlur?(newValue: string): void;
    rows: number;
}
export default function FormTextArea({ id, onBlur, rows, currentValue }: FormTextAreaProps) {
    return (
        <textarea
            id={id}
            rows={rows}
            onBlur={(e) => {
                onBlur?.(e.currentTarget.value);
            }}
            style={{ width: "100%" }}
        >{currentValue}</textarea>
    )
}
