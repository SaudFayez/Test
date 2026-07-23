import { el } from "../core/dom.js";

export function field(labelText, inputEl) {
  return el("div", "field", el("label", null, labelText), inputEl);
}

export function textInput(props = {}) {
  return el("input", { class: "input", type: "text", ...props });
}

export function numberInput(props = {}) {
  return el("input", { class: "input", type: "number", ...props });
}

export function dateInput(props = {}) {
  return el("input", { class: "input", type: "date", ...props });
}

export function timeInput(props = {}) {
  return el("input", { class: "input", type: "time", ...props });
}

export function textArea(props = {}) {
  return el("textarea", { class: "input", ...props });
}

// options: [{ value, label }], selected value matched against `value` prop.
export function select(options, props = {}) {
  const { value, ...rest } = props;
  const node = el(
    "select",
    { class: "input", ...rest },
    options.map((opt) => el("option", { value: opt.value }, opt.label))
  );
  if (value !== undefined && value !== null) node.value = value;
  return node;
}

export function formRow(...fields) {
  return el("div", "form-row", fields);
}
