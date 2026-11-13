import React, { useEffect, useMemo, useRef, useState } from "react";

type CommonProps = { id?: string; className?: string; children?: React.ReactNode; disabled?: boolean; };
type ButtonProps = CommonProps & { "aria-current"?: string; type?: "button"|"submit"|"reset"; href?: string; kind?: "primary"|"secondary"|"tertiary"|"ghost"|"danger"|"danger--primary"; size?: "sm"|"md"|"lg"; onClick?: React.MouseEventHandler<HTMLButtonElement>; "aria-pressed"?: boolean; "aria-expanded"?: boolean; "aria-controls"?: string; "aria-label"?: string; };
export function Button({children,id,className="",disabled,type="button",href,onClick,kind="primary",size="md",...aria}:ButtonProps){
 const cls=`m-control m-button m-button--${kind.replace("--","-")} m-button--${size} ${className}`.trim();
 return href ? <a id={id} className={cls} href={disabled?undefined:href} aria-disabled={disabled||undefined} {...aria}>{children}</a> : <button id={id} className={cls} type={type} disabled={disabled} onClick={onClick} {...aria}>{children}</button>;
}

type TextInputProps = CommonProps & { name?:string; labelText?:string; label?:string; type?:string; value?:string|number; defaultValue?:string|number; placeholder?:string; onChange?:(event:React.ChangeEvent<HTMLInputElement>)=>void; hideLabel?:boolean; size?:"sm"|"md"|"lg"; helperText?:React.ReactNode; invalid?:boolean; invalidText?:React.ReactNode; required?:boolean; readOnly?:boolean; autoComplete?:string; min?:number|string; max?:number|string; step?:number|string; maxLength?:number; };
export function TextInput({id,name,labelText,label, type="text",value,defaultValue,placeholder,onChange,hideLabel,size="md",helperText,invalid,invalidText,required,readOnly,autoComplete,min,max,step,maxLength,className=""}:TextInputProps){
 const title=labelText??label??"";
 return <div className={`m-field ${className} ${invalid?"is-invalid":""}`}><label className={hideLabel?"m-sr-only":"m-field__label"} htmlFor={id}>{title}{required?<span aria-hidden="true"> *</span>:null}</label><input className={`m-input m-input--${size}`} id={id} name={name} type={type} value={value} defaultValue={value===undefined?defaultValue:undefined} placeholder={placeholder} onChange={onChange} required={required} readOnly={readOnly} autoComplete={autoComplete} min={min} max={max} step={step} maxLength={maxLength} aria-invalid={invalid||undefined}/>{invalid&&invalidText?<small className="m-field__error">{invalidText}</small>:helperText?<small className="m-field__help">{helperText}</small>:null}</div>;
}
type TextAreaProps = CommonProps & { name?:string; labelText?:string; value?:string; defaultValue?:string; placeholder?:string; onChange?:(event:React.ChangeEvent<HTMLTextAreaElement>)=>void; rows?:number; hideLabel?:boolean; required?:boolean; maxLength?:number; };
export function TextArea({id,name,labelText="",value,defaultValue,placeholder,onChange,rows=4,hideLabel,required,maxLength,className=""}:TextAreaProps){
 return <div className={`m-field ${className}`}><label className={hideLabel?"m-sr-only":"m-field__label"} htmlFor={id}>{labelText}</label><textarea className="m-input m-textarea" id={id} name={name} value={value} defaultValue={value===undefined?defaultValue:undefined} placeholder={placeholder} onChange={onChange} rows={rows} required={required} maxLength={maxLength}/></div>;
}
type CheckboxProps = CommonProps & {id:string;name?:string;value?:string;defaultChecked?:boolean;checked?:boolean;onChange?:(event:React.ChangeEvent<HTMLInputElement>)=>void;required?:boolean;};
export function Checkbox({id,name,value,defaultChecked,checked,onChange,required,children,className=""}:CheckboxProps){
 return <label className={`m-checkbox ${className}`}><input id={id} name={name} type="checkbox" value={value} defaultChecked={checked===undefined?defaultChecked:undefined} checked={checked} onChange={onChange} required={required}/><span className="m-checkbox__mark" aria-hidden="true"/><span>{children}</span></label>;
}
type FileUploaderProps = CommonProps & {name?:string;accept?:string[];multiple?:boolean;buttonLabel?:string;labelTitle?:string;labelDescription?:string;};
export function FileUploader({id,name,accept=[],multiple=true,buttonLabel="Choose files",labelTitle,labelDescription,className=""}:FileUploaderProps){
 const [files,setFiles]=useState<string[]>([]);
 return <div className={`m-upload ${className}`}><label className="m-field__label" htmlFor={id}>{labelTitle}</label>{labelDescription?<p className="m-field__help">{labelDescription}</p>:null}<label className="m-upload__button" htmlFor={id}>＋ {buttonLabel}<input id={id} name={name} type="file" accept={accept.join(",")} multiple={multiple} onChange={e=>setFiles(Array.from(e.target.files??[]).map(f=>f.name))}/></label>{files.length?<ul className="m-upload__files">{files.map(f=><li key={f}>{f}</li>)}</ul>:null}</div>;
}
type NotificationProps = CommonProps & {kind?:"info"|"success"|"warning"|"error";title?:string;subtitle?:React.ReactNode;};
export function InlineNotification({kind="info",title,subtitle,children}:NotificationProps){
 return <div className={`m-notice m-notice--${kind}`} role="status"><strong>{title}</strong><div>{subtitle??children}</div></div>;
}
type Item = {value:string;label:string;logo?:string;raw?:unknown;};
type ComboProps = CommonProps & {items:Item[];selectedItem?:Item|null;initialSelectedItem?:Item|null;onChange?:(arg:{selectedItem:Item|null})=>void;itemToString?:(item:Item|null)=>string;itemToElement?:(item:Item)=>React.ReactNode;titleText?:string;placeholder?:string;disabled?:boolean;size?:"sm"|"md"|"lg";shouldFilterItem?:(arg:{item:Item;inputValue:string;itemToString?:(item:Item|null)=>string})=>boolean;};
export function ComboBox({id,items,selectedItem,initialSelectedItem,onChange,itemToString,titleText="",placeholder="Select",disabled,size="md",itemToElement,shouldFilterItem,className=""}:ComboProps){
 const [selected,setSelected]=useState<Item|null>(selectedItem??initialSelectedItem??null);
 const [query,setQuery]=useState("");
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{setSelected(selectedItem??initialSelectedItem??null)},[selectedItem,initialSelectedItem]);
 useEffect(()=>{const close=(e:MouseEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[]);
 const text=(item:Item|null)=>itemToString?itemToString(item):item?.label??"";
 const filtered=useMemo(()=>items.filter(item=>shouldFilterItem?shouldFilterItem({item,inputValue:query,itemToString:text}):text(item).toLowerCase().includes(query.toLowerCase())),[items,query]);
 const choose=(item:Item)=>{setSelected(item);setQuery("");setOpen(false);onChange?.({selectedItem:item})};
 return <div className={`m-combo ${className}`} ref={root}><label className="m-field__label" htmlFor={id}>{titleText}</label><div className="m-combo__field"><input id={id} className={`m-input m-input--${size}`} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-listbox`} value={open?query:text(selected)} placeholder={placeholder} disabled={disabled} onFocus={()=>{setOpen(true);setQuery("")}} onChange={e=>{setQuery(e.target.value);setOpen(true)}} onKeyDown={e=>{if(e.key==="Escape")setOpen(false);if(e.key==="Enter"&&filtered[0]){e.preventDefault();choose(filtered[0])}}}/>{selected&&!open?<button type="button" className="m-combo__clear" aria-label="Clear selection" onClick={()=>{setSelected(null);onChange?.({selectedItem:null})}}>×</button>:null}<span className="m-combo__chevron" aria-hidden="true">⌄</span></div>{open?<ul id={`${id}-listbox`} className="m-combo__list" role="listbox">{filtered.length?filtered.map(item=><li key={item.value} role="option" aria-selected={selected?.value===item.value}><button type="button" onClick={()=>choose(item)}>{itemToElement?itemToElement(item):<>{item.logo?<img src={item.logo} alt="" loading="lazy"/>:null}<span>{item.label}</span>}</button></li>):<li className="m-combo__empty">No matching options</li>}</ul>:null}</div>;
}
