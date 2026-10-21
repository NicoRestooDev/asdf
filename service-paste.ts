import type { ServiceData } from "./services"

export function fillServiceForm(data: ServiceData) {
  type Control =
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement

  let started = false

  try {
    const fields = data?.fields

    if (
      data?.version !== 1 ||
      !fields ||
      typeof fields !== "object" ||
      Array.isArray(fields)
    ) {
      throw new Error("La copia no es válida. Vuelve a copiar el servicio.")
    }

    if (data.sourceOrigin !== location.origin) {
      throw new Error(
        "Esta versión permite pegar dentro del mismo restaurante."
      )
    }

    const form = document
      .querySelector('select[name="type_id"]')
      ?.closest("form")

    if (
      !form ||
      !location.pathname.endsWith("/settings/shifts/create") ||
      form.querySelector('input[name="_method"]')
    ) {
      throw new Error("Abre Nuevo servicio para pegar los datos.")
    }

    // Estas funciones pertenecen a la página de Restoo.
    const page = window as any
    const $ = page.jQuery

    if (!$?.fn?.pickatime) {
      throw new Error("Espera a que termine de cargar el formulario.")
    }

    const group = (name: string) =>
      Array.from(
        form.querySelectorAll<Control>(
          "input[name], select[name], textarea[name]"
        )
      ).filter((control) => control.name === name)

    const notify = (control: Control) => {
      control.dispatchEvent(new Event("input", { bubbles: true }))
      control.dispatchEvent(new Event("change", { bubbles: true }))
    }

    const times = [
      "first_visit_at",
      "last_visit_at",
      "cp_start_time",
      "cp_end_time"
    ]

    const excluded = new Set([
      "_token",
      "_method",
      "time_pacings_json",
      "table_exception_time",
      "table_exception_group_id"
    ])

    const entries = Object.entries(fields)
    const exceptions = new Map<string, Record<string, string>>()
    const pickers = new Map<string, any>()

    // 1. Comprobar los campos y sus opciones antes de rellenar.
    for (const [name, value] of entries) {
      if (!name || excluded.has(name)) {
        throw new Error("Campo no permitido: " + name)
      }

      const exception = name.match(
        /^table_exceptions\[([^\]]+)\]\[(time|table_group_id|is_available)\]$/
      )

      if (exception) {
        if (typeof value !== "string") {
          throw new Error("Excepción de mesas no válida.")
        }

        const item = exceptions.get(exception[1]) ?? {}
        item[exception[2]] = value
        exceptions.set(exception[1], item)
        continue
      }

      const controls = group(name)

      if (!controls.length) {
        throw new Error("Falta este campo en el destino: " + name)
      }

      const checks = controls.filter(
        (c): c is HTMLInputElement =>
          c instanceof HTMLInputElement && c.type === "checkbox"
      )

      const radios = controls.filter(
        (c): c is HTMLInputElement =>
          c instanceof HTMLInputElement && c.type === "radio"
      )

      const first = controls[0]
      const multi = first instanceof HTMLSelectElement && first.multiple

      const options =
        first instanceof HTMLSelectElement
          ? Array.from(first.options)
          : radios

      if (checks.length || multi) {
        if (name.endsWith("[]") || multi) {
          const available = multi
            ? Array.from((first as HTMLSelectElement).options)
            : checks

          if (
            !Array.isArray(value) ||
            value.some(
              (v) =>
                typeof v !== "string" ||
                !available.some((c) => c.value === v)
            )
          ) {
            throw new Error("Selección incompatible: " + name)
          }
        } else if (typeof value !== "boolean") {
          throw new Error("Casilla incompatible: " + name)
        }
      } else if (
        typeof value !== "string" ||
        (options.length > 0 &&
          !options.some((option) => option.value === value))
      ) {
        throw new Error("Valor incompatible: " + name)
      }

      if (times.includes(name)) {
        const input = form.querySelector<HTMLInputElement>("#" + name)
        const picker = input && $(input).pickatime("picker")

        if (
          !picker ||
          typeof value !== "string" ||
          (value !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
        ) {
          throw new Error("Hora incompatible: " + name)
        }

        pickers.set(name, picker)
      }

      if (
        /^time_pacings\[.+\]\[(time|floor_plan_area_id)\]$/.test(name) &&
        first.value !== value
      ) {
        throw new Error("El tramo no corresponde al destino: " + name)
      }
    }

    for (const name of ["type_id", "first_visit_at", "last_visit_at"]) {
      if (typeof fields[name] !== "string" || !fields[name]) {
        throw new Error("La copia no tiene " + name)
      }
    }

    const exceptionContainer = form.querySelector("#table-exceptions")

    const exceptionSelect = form.querySelector<HTMLSelectElement>(
      'select[name="table_exception_group_id"]'
    )

    if (
      exceptions.size &&
      (!exceptionContainer ||
        !exceptionSelect ||
        typeof page.addTableException !== "function")
    ) {
      throw new Error("El destino no admite estas excepciones de mesas.")
    }

    for (const [key, item] of exceptions) {
      if (
        !/^([01]\d|2[0-3]):[0-5]\d:00$/.test(item.time ?? "") ||
        !["0", "1"].includes(item.is_available) ||
        !Array.from(exceptionSelect!.options).some(
          (option) => option.value === item.table_group_id
        ) ||
        key !== item.time.slice(0, 5) + "_" + item.table_group_id
      ) {
        throw new Error("Excepción de mesas incompatible.")
      }
    }

    // Auxiliar para aplicar un valor y avisar a los controles de Restoo.
    const write = (
      name: string,
      value: string | boolean | string[]
    ) => {
      if (pickers.has(name)) {
        const picker = pickers.get(name)

        if (value === "") {
          picker.clear()
        } else {
          picker.set("select", (value as string).split(":").map(Number))
        }

        return
      }

      const controls = group(name)

      const radios = controls.filter(
        (c): c is HTMLInputElement =>
          c instanceof HTMLInputElement && c.type === "radio"
      )

      if (radios.length) {
        for (const radio of radios) {
          radio.checked = radio.value === value
        }

        const selected = radios.find((radio) => radio.checked)
        if (selected) notify(selected)
        return
      }

      for (const control of controls) {
        if (
          control instanceof HTMLInputElement &&
          control.type === "checkbox"
        ) {
          control.checked = Array.isArray(value)
            ? value.includes(control.value)
            : value === true
        } else if (
          typeof value === "boolean" ||
          (Array.isArray(value) && !(control instanceof HTMLSelectElement))
        ) {
          // Conservamos los campos ocultos asociados a las casillas.
          continue
        } else if (
          control instanceof HTMLSelectElement &&
          control.multiple
        ) {
          for (const option of control.options) {
            option.selected = (value as string[]).includes(option.value)
          }
        } else {
          control.value = value as string
        }

        notify(control)
      }
    }

    started = true

    // 2. Limpiar la selección anterior de tramos.
    if (group("is_time_pacings_active").length) {
      write("is_time_pacings_active", false)
    }

    for (const checkbox of form.querySelectorAll<HTMLInputElement>(
      "#time-pacing-areas .js-tp-is-active"
    )) {
      checkbox.checked = false
      notify(checkbox)
    }

    // 3. Rellenar campos generales y actualizar las horas.
    for (const [name, value] of entries) {
      if (
        !times.includes(name) &&
        name !== "is_time_pacings_active" &&
        !name.startsWith("time_pacings[") &&
        !name.startsWith("table_exceptions[")
      ) {
        write(name, value)
      }
    }

    for (const name of times) {
      if (pickers.has(name)) write(name, fields[name])
    }

    // 4. Crear las filas de las excepciones copiadas.
    exceptionContainer?.replaceChildren()

    for (const item of exceptions.values()) {
      page.addTableException(
        item.time.slice(0, 5),
        item.table_group_id
      )
    }

    for (const [name, value] of entries) {
      if (name.startsWith("table_exceptions[")) write(name, value)
    }

    // 5. Activar los tramos antes de rellenar sus límites.
    if ("is_time_pacings_active" in fields) {
      write("is_time_pacings_active", fields.is_time_pacings_active)
    }

    const pacingEntries = entries.filter(([name]) =>
      name.startsWith("time_pacings[")
    )

    for (const [name, value] of pacingEntries) {
      if (name.endsWith("[is_active]")) write(name, value)
    }

    for (const [name, value] of pacingEntries) {
      if (!name.endsWith("[is_active]")) write(name, value)
    }

    // 6. Verificar los valores finales.
    for (const [name, expected] of entries) {
      const controls = group(name)

      if (!controls.length) {
        throw new Error("No se pudo crear el campo " + name)
      }

      const choice = controls.find(
        (c) =>
          c instanceof HTMLInputElement &&
          ["checkbox", "radio"].includes(c.type)
      ) as HTMLInputElement | undefined

      const selected = controls.filter(
        (c): c is HTMLInputElement =>
          c instanceof HTMLInputElement && c.checked
      )

      const first = controls[0]
      let actual: string | boolean | string[]

      if (choice?.type === "checkbox") {
        actual = name.endsWith("[]")
          ? selected.map((c) => c.value)
          : choice.checked
      } else if (choice?.type === "radio") {
        actual = selected[0]?.value ?? ""
      } else if (
        first instanceof HTMLSelectElement &&
        first.multiple
      ) {
        actual = Array.from(first.selectedOptions, (o) => o.value)
      } else {
        actual = first.value
      }

      const normalize = (value: string | boolean | string[]) =>
        JSON.stringify(Array.isArray(value) ? [...value].sort() : value)

      if (normalize(actual) !== normalize(expected)) {
        throw new Error("No se pudo aplicar " + name)
      }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error:
        (started ? "Pegado incompleto. " : "") +
        (error instanceof Error
          ? error.message
          : "No se pudo pegar el servicio.")
    }
  }
}