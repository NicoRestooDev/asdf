import { readServiceForm } from "./services"
import type {ServiceData} from "./services"

type GeneralFormData = {
  name?: string
  address_1?: string
  address_2?: string
  city?: string
  province?: string
  zip?: string
  country?: string
  website?: string
  organization_fiscal_name?: string
  organization_fiscal_vat?: string
  organization_fiscal_email?: string
}

type FillGeneralFormMessage = {
  type?: string
  payload?: GeneralFormData
}

function dispatchInputEvents(element: HTMLInputElement | HTMLSelectElement) {
  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

function setInputValue(selector: string, value?: string) {
  const input = document.querySelector(selector) as HTMLInputElement | null

  if (!input) {
    console.warn("No se encontró el selector", selector)
    return
  }

  input.value = value ?? ""
  dispatchInputEvents(input)
}

function setSelectValue(selector: string, textValue?: string) {
  const select = document.querySelector(selector) as HTMLSelectElement | null

  if (!select) {
    console.warn("No se encontró el selector", selector)
    return
  }

  const option = Array.from(select.options).find(
    (opt) => opt.value === textValue || opt.text.trim() === textValue
  )

  if (!option) {
    console.warn("Opción no encontrada", textValue)
    return
  }

  select.value = option.value
  dispatchInputEvents(select)
}

function setCheckbox(selector: string, checked: boolean) {
  const checkbox = document.querySelector(selector) as HTMLInputElement | null

  if (!checkbox) {
    console.warn("No se encontró el selector", selector)
    return
  }

  checkbox.checked = checked
  checkbox.dispatchEvent(new Event("change", { bubbles: true }))
}

function clickElement(selector: string) {
  const element = document.querySelector(selector) as HTMLElement | null

  if (!element) {
    console.warn("No se encontró el elemento", selector)
    return
  }

  element.click()
}

function fillGeneralData(data: GeneralFormData) {
  setInputValue("#name", data.name)
  setInputValue("#direction_1", data.address_1)
  setInputValue("#direction_2", data.address_2)
  setInputValue("#city", data.city)
  setInputValue("#province", data.province)
  setInputValue("#zip", data.zip)
  setSelectValue("#country", data.country)
  setInputValue("#website", data.website)

  setInputValue("#organization_fiscal_name", data.organization_fiscal_name)
  setInputValue("#organization_fiscal_vat", data.organization_fiscal_vat)
  setInputValue("#organization_fiscal_email", data.organization_fiscal_email)

  setCheckbox("#beta_restoo_2_default", true)
  setCheckbox("#beta_widget_v2_default", true)
  clickElement("#copy_legal_address_from_venue")
}

chrome.runtime.onMessage.addListener(
  (
    message: FillGeneralFormMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: {
      ok: boolean
      data?: ServiceData
      error?: string
    }) => void
  ) => {

  if (message.type === "READ_SERVICE_FORM") {
      try {
          const data = readServiceForm()
          sendResponse({ ok: true, data })
      } catch (error) {
        sendResponse({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "No se pudo leer el servicio"
      })
  }

  return
}
  if (message.type !== "FILL_GENERAL_FORM") {
    sendResponse({ ok: false })
    return
  }
  
  

  const data = message.payload

  if (!data) {
    console.warn("No se recibió payload para rellenar el formulario")
    sendResponse({ ok: false })
    return
  }

  console.log("Payload recibido en content script:", data)

  try {
    fillGeneralData(data)
    sendResponse({ ok: true })
  } catch (error) {
    console.error("Error rellenando formulario:", error)
    sendResponse({ ok: false })
  }
})
