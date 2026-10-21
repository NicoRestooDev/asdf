type FormControl =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement

type FieldValue = string | boolean | string[]

export type ServiceData = {
  version: 1
  sourceOrigin: string
  label: string
  fields: Record<string, FieldValue>
}

export function readServiceForm(): ServiceData {
  const typeSelect = document.querySelector<HTMLSelectElement>(
    'select[name="type_id"]'
  )

  const form = typeSelect?.closest("form")

  if (
    !form ||
    !typeSelect ||
    !form.querySelector('[name="first_visit_at"]')
  ) {
    throw new Error("Abre un formulario de servicio para copiarlo")
  }

  const excluded = new Set([
    "_token",
    "_method",
    "time_pacings_json",
    "table_exception_time",
    "table_exception_group_id"
  ])

  const groups = new Map<string, FormControl[]>()

  const controls = form.querySelectorAll<FormControl>(
    "input[name], select[name], textarea[name]"
  )

  for (const control of controls) {
    const name = control.name

    if (!name || excluded.has(name)) continue

    if (
      control instanceof HTMLInputElement &&
      ["submit", "button", "reset", "file"].includes(control.type)
    ) {
      continue
    }

    // De los tramos horarios, capturamos las filas activas.
    if (name.startsWith("time_pacings[")) {
      const active = control
        .closest("tr")
        ?.querySelector<HTMLInputElement>(
          'input[type="checkbox"].js-tp-is-active'
        )

      if (!active?.checked || active.matches(":disabled")) continue
    }

    const group = groups.get(name) ?? []
    group.push(control)
    groups.set(name, group)
  }

  const fields: Record<string, FieldValue> = {}

  for (const [name, group] of groups) {
    // Una casilla tiene prioridad sobre su campo oculto asociado.
    const control =
      group.find(
        (element) =>
          element instanceof HTMLInputElement &&
          ["checkbox", "radio"].includes(element.type)
      ) ?? group[0]

    if (
      control instanceof HTMLInputElement &&
      ["checkbox", "radio"].includes(control.type)
    ) {
      const selected = group.filter(
        (element): element is HTMLInputElement =>
          element instanceof HTMLInputElement && element.checked
      )

      if (control.type === "radio") {
        fields[name] = selected[0]?.value ?? ""
      } else if (name.endsWith("[]")) {
        fields[name] = selected.map((element) => element.value)
      } else {
        fields[name] = control.checked
      }
    } else if (
      control instanceof HTMLSelectElement &&
      control.multiple
    ) {
      fields[name] = Array.from(
        control.selectedOptions,
        (option) => option.value
      )
    } else {
      fields[name] = control.value
    }
  }

  return {
    version: 1,
    sourceOrigin: location.origin,
    label: typeSelect.selectedOptions[0]?.text.trim() || "Servicio",
    fields
  }
}