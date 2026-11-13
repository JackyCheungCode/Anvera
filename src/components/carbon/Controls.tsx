import React, { useState } from "react";
import {
  Button as CarbonButton,
  Checkbox as CarbonCheckbox,
  ComboBox,
  InlineNotification as CarbonInlineNotification,
  TextInput as CarbonTextInput
} from "@carbon/react";

type ButtonVariant = "primary" | "secondary" | "dark";
type ButtonControlProps = {
  children: React.ReactNode;
  href?: string;
  variant?: ButtonVariant;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

export function ButtonControl({
  children,
  href,
  variant = "primary",
  type = "button",
  disabled = false
}: ButtonControlProps) {
  const kind = variant === "dark" ? "tertiary" : variant;
  return (
    <CarbonButton kind={kind} size="lg" type={type} href={disabled ? undefined : href} disabled={disabled}>
      {children}
    </CarbonButton>
  );
}

type TextInputControlProps = {
  id: string;
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "url";
  value?: string;
  placeholder?: string;
  required?: boolean;
  autocomplete?: string;
  helpText?: string;
};

export function TextInputControl({
  id, name, label, type = "text", value, placeholder, required = false, autocomplete, helpText
}: TextInputControlProps) {
  return (
    <CarbonTextInput
      id={id}
      name={name}
      labelText={label}
      type={type}
      value={value}
      placeholder={placeholder}
      required={required}
      autoComplete={autocomplete}
      helperText={helpText}
    />
  );
}

type CheckboxControlProps = {
  id: string;
  name: string;
  value?: string;
  checked?: boolean;
  required?: boolean;
  children: React.ReactNode;
};

export function CheckboxControl({
  id, name, value = "on", checked = false, required = false, children
}: CheckboxControlProps) {
  return (
    <CarbonCheckbox
      id={id}
      name={name}
      value={value}
      defaultChecked={checked}
      required={required}
      labelText={children}
    />
  );
}

type NotificationKind = "info" | "success" | "warning" | "error";
type NotificationControlProps = {
  kind?: NotificationKind;
  title: string;
  children?: React.ReactNode;
};

export function NotificationControl({
  kind = "info", title, children
}: NotificationControlProps) {
  return (
    <CarbonInlineNotification
      kind={kind}
      title={title}
      subtitle={children}
      lowContrast
      hideCloseButton
    />
  );
}

type DropdownOption = { value: string; label: string };
type DropdownControlProps = {
  id: string;
  name: string;
  label: string;
  options: DropdownOption[];
  value?: string;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
};

export function DropdownControl({
  id, name, label, options, value = "", placeholder = "Select an option", required = false, helpText
}: DropdownControlProps) {
  const initial = options.find((option) => option.value === value) ?? null;
  const [selected, setSelected] = useState<DropdownOption | null>(initial);
  const itemToString = (item: DropdownOption | null) => item?.label ?? "";

  return (
    <div className="anvera-carbon-dropdown">
      <input type="hidden" name={name} value={selected?.value ?? ""} />
      <ComboBox
        id={id}
        items={options}
        itemToString={itemToString}
        titleText={label}
        placeholder={placeholder}
        selectedItem={selected}
        onChange={({ selectedItem }) => setSelected(selectedItem ?? null)}
        shouldFilterItem={({ item, inputValue, itemToString: toString }) =>
          toString(item).toLocaleLowerCase().includes(inputValue.toLocaleLowerCase())
        }
        helperText={helpText}
        required={required}
        size="lg"
      />
    </div>
  );
}
