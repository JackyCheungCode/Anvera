import React, { useState } from "react";
import {
  Button as CarbonButton,
  Checkbox as CarbonCheckbox,
  ComboBox,
  FileUploader as CarbonFileUploader,
  InlineNotification as CarbonInlineNotification,
  TextArea as CarbonTextArea,
  TextInput as CarbonTextInput
} from "../bmw-m/Controls";

type ButtonVariant = "primary" | "secondary" | "dark" | "ghost";
type ButtonControlProps = {
  children: React.ReactNode;
  href?: string;
  variant?: ButtonVariant;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  id?: string;
  className?: string;
  filterKey?: string;
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
  productKey?: string;
  ariaControls?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

export function ButtonControl({
  children,
  href,
  variant = "primary",
  type = "button",
  disabled = false,
  id,
  className,
  filterKey,
  ariaPressed,
  ariaExpanded,
  productKey,
  ariaControls,
  onClick
}: ButtonControlProps) {
  const kind = variant === "dark" ? "tertiary" : variant === "ghost" ? "ghost" : variant;
  return (
    <CarbonButton id={id} className={className} data-wheel-filter={filterKey} data-product={productKey} aria-pressed={ariaPressed} aria-expanded={ariaExpanded} aria-controls={ariaControls} onClick={onClick} kind={kind} size="lg" type={type} href={disabled ? undefined : href} disabled={disabled}>
      {children}
    </CarbonButton>
  );
}

type TextInputControlProps = {
  id: string;
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "url" | "search" | "password";
  value?: string;
  placeholder?: string;
  required?: boolean;
  autocomplete?: string;
  helpText?: string;
  className?: string;
  readOnly?: boolean;
};

export function TextInputControl({
  id, name, label, type = "text", value, placeholder, required = false, autocomplete, helpText, className, readOnly
}: TextInputControlProps) {
  return (
    <CarbonTextInput
      id={id}
      name={name}
      className={className}
      readOnly={readOnly}
      labelText={label}
      type={type}
      defaultValue={value}
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
      labelText={children ?? ""}
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
      subtitle={typeof children === "string" ? children : undefined}
      lowContrast
      hideCloseButton
    />
  );
}

type DropdownOption = { value: string; label: string; logo?: string };
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
        shouldFilterItem={({ item, inputValue, itemToString: toString }) => {
          const label = toString?.(item) ?? "";
          const query = inputValue ?? "";
          return label.toLocaleLowerCase().includes(query.toLocaleLowerCase());
        }}
        helperText={helpText}
        required={required}
        size="lg"
      />
    </div>
  );
}


export type CarbonVehicleOption = { value: string; label: string; raw: unknown; logo?: string };
type DynamicComboBoxControlProps = {
  id: string;
  label: string;
  placeholder: string;
  items: CarbonVehicleOption[];
  selectedItem: CarbonVehicleOption | null;
  disabled?: boolean;
  onChange: (item: CarbonVehicleOption | null) => void;
};

export function DynamicComboBoxControl({
  id, label, placeholder, items, selectedItem, disabled = false, onChange
}: DynamicComboBoxControlProps) {
  const itemToString = (item: CarbonVehicleOption | null) => item?.label ?? "";
  return (
    <div className="anvera-carbon-vehicle-combo">
      {selectedItem?.logo ? <span className="anvera-carbon-selected-logo"><img src={selectedItem.logo} alt="" /></span> : null}
      <ComboBox
        id={id}
        titleText={label}
        placeholder={placeholder}
        items={items}
        selectedItem={selectedItem}
        itemToString={itemToString}
        itemToElement={(item) => item ? <span className="anvera-carbon-combo-item">{item.logo ? <img src={item.logo} alt="" loading="lazy" /> : null}<span>{item.label}</span></span> : null}
        disabled={disabled}
        size="lg"
        onChange={({ selectedItem: next }) => onChange(next ?? null)}
        shouldFilterItem={({ item, inputValue, itemToString: toString }) => {
          const label = toString?.(item) ?? "";
          return label.toLocaleLowerCase().includes((inputValue ?? "").toLocaleLowerCase());
        }}
      />
    </div>
  );
}


type TextAreaControlProps = {
  id: string;
  name: string;
  label: string;
  value?: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  helpText?: string;
  className?: string;
};

export function TextAreaControl({
  id, name, label, value, placeholder, rows = 4, required = false, helpText, className
}: TextAreaControlProps) {
  return (
    <CarbonTextArea
      id={id}
      name={name}
      className={className}
      labelText={label}
      defaultValue={value}
      placeholder={placeholder}
      rows={rows}
      required={required}
      helperText={helpText}
    />
  );
}


type FileUploaderControlProps = {
  id: string;
  name: string;
  label: string;
  accept: string[];
  multiple?: boolean;
  description?: string;
  buttonLabel?: string;
};

export function FileUploaderControl({
  id, name, label, accept, multiple = true, description, buttonLabel = "Add files"
}: FileUploaderControlProps) {
  return (
    <CarbonFileUploader
      id={id}
      name={name}
      accept={accept}
      multiple={multiple}
      filenameStatus="edit"
      buttonLabel={buttonLabel}
      iconDescription="Remove file"
      labelTitle={label}
      labelDescription={description}
      buttonKind="secondary"
      size="md"
    />
  );
}


type FilterComboBoxControlProps = {
  id: string;
  label: string;
  items: Array<{ value: string; label: string }>;
  selectedItem: { value: string; label: string } | null;
  onChange: (item: { value: string; label: string } | null) => void;
};

export function FilterComboBoxControl({ id, label, items, selectedItem, onChange }: FilterComboBoxControlProps) {
  return (
    <ComboBox
      id={id}
      titleText={label}
      placeholder={`All ${label.toLowerCase()}s`}
      items={items}
      selectedItem={selectedItem}
      itemToString={(item) => item?.label ?? ""}
      onChange={({ selectedItem: next }) => onChange(next ?? null)}
      size="lg"
    />
  );
}
