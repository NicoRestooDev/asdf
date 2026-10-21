import { useEffect, useState } from "react"

import icon from "./assets/icon.png"
import sampleData from "./sampleData.js"
import { fillServiceForm } from "./service-paste"

type Restaurant = {
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

function Popup() {
  const [jsonText, setJsonText] = useState("")
  const [status, setStatus] = useState("")
  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  const [activeTab, setActiveTab] = useState<"alta" | "servicios">("servicios")
  const [isCopying, setIsCopying] = useState(false)
  const [isPasting, setIsPasting] = useState(false)
  const [hasCopiedService, setHasCopiedService] = useState(false)
  const [isLoadingService, setIsLoadingService] = useState(true)

  useEffect(() => {
    chrome.storage.local
      .get("copiedService")
      .then(({ copiedService }) => {
        setHasCopiedService(copiedService?.version === 1)
      })
      .catch(() => {
        setStatus("No se pudo consultar el servicio copiado")
      })
      .finally(() => {
        setIsLoadingService(false)
      })
  }, [])

  const restaurants: Restaurant[] = sampleData

  const handleImportClick = (restaurant: Restaurant) => {
    setStatus(`Buscando pestaña activa para ${restaurant.name}...`)

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0]

      if (!activeTab?.id) {
        setStatus("No se encontró una pestaña activa válida")
        return
      }

      setStatus(`Enviando datos de ${restaurant.name}...`)

      chrome.tabs.sendMessage(
        activeTab.id,
        {
          type: "FILL_GENERAL_FORM",
          payload: restaurant
        },
        (response) => {
          if (chrome.runtime.lastError) {
            setStatus("No se pudo contactar con el content script")
            console.error(chrome.runtime.lastError.message)
            return
          }

          if (response?.ok) {
            setStatus(`${restaurant.name} rellenado correctamente`)
          } else {
            setStatus("El content script respondió sin confirmación")
          }
        }
      )
    })
  }
  const handleCopyService = async () => {
    setIsCopying(true)
    setStatus("Leyendo el servicio...")

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      if (tab?.id === undefined) {
        throw new Error("No se encontró la pestaña activa")
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "READ_SERVICE_FORM"
      })

      if (!response?.ok || !response.data) {
        throw new Error(response?.error ?? "No se pudo leer el servicio")
      }

      await chrome.storage.local.set({
        copiedService: response.data
      })

      setHasCopiedService(true)

      setStatus(`Servicio copiado: ${response.data.label}`)
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "No se pudo copiar el servicio"
      )
    } finally {
      setIsCopying(false)
    }
  }

  const handlePasteService = async () => {
    setIsPasting(true)
    setStatus("Comprobando y rellenando el formulario...")

    try {
      const { copiedService } = await chrome.storage.local.get("copiedService")

      if (!copiedService) {
        throw new Error("Primero copia un servicio")
      }

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      if (tab?.id === undefined) {
        throw new Error("No se encontró la pestaña activa")
      }

      if (!tab.url || new URL(tab.url).origin !== copiedService.sourceOrigin) {
        throw new Error("Abre Nuevo servicio en el restaurante de origen")
      }

      const [execution] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: fillServiceForm,
        args: [copiedService]
      })

      if (!execution?.result?.ok) {
        throw new Error(
          execution?.result?.error ?? "No se pudo completar el pegado"
        )
      }

      setStatus("Formulario rellenado. Revisa los datos y pulsa Guardar.")
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "No se pudo pegar el servicio"
      )
    } finally {
      setIsPasting(false)
    }
  }
  return (
    <div
      style={{
        width: 360,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        backgroundColor: "#0671D7"
      }}>
      <img
        src={icon}
        alt="Restoo Onboarding Helper"
        style={{ width: 64, height: 64, objectFit: "contain" }}
      />

      <h1 style={{ margin: 0, fontSize: 18, color: "white" }}>
        Restoo Onboarding Helper
      </h1>

      <nav
        aria-label="Secciones de la extensión"
        style={{
          display: "flex",
          gap: 8
        }}>
        <button
          type="button"
          aria-pressed={activeTab === "alta"}
          style={{
            padding: "12px 16px",
            width: "100%",
            color: "#ffffff",
            border: "none",
            borderRadius: 18,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            backgroundColor: "#111827"
          }}
          onClick={() => {
            setActiveTab("alta")
            setStatus("")
          }}>
          Alta
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "servicios"}
          style={{
            padding: "12px 16px",
            width: "100%",
            color: "#ffffff",
            border: "none",
            borderRadius: 18,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            backgroundColor: "#111827"
          }}
          onClick={() => {
            setActiveTab("servicios")
            setStatus("")
          }}>
          Servicios
        </button>
      </nav>

      {activeTab === "alta" &&
        restaurants.map((restaurant, index) => (
          <button
            key={`${restaurant.name}-${index}`}
            type="button"
            onClick={() => handleImportClick(restaurant)}
            style={{
              padding: "12px 16px",
              width: "100%",
              color: "#ffffff",
              border: "none",
              borderRadius: 18,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              backgroundColor: "#111827"
            }}>
            Rellenar {restaurant.name}
          </button>
        ))}
      {activeTab === "servicios" && (
        <div style={{ width: "100%", display: "grid", gap: 8 }}>
          <button
            type="button"
            disabled={isCopying || isPasting || isLoadingService}
            onClick={handleCopyService}
            style={{
              padding: "12px 16px",
              width: "100%",
              color: "#ffffff",
              border: "none",
              borderRadius: 18,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              backgroundColor: "#111827"
            }}>
            Copiar Servicio
          </button>

          <button
            type="button"
            disabled={
              isCopying || isPasting || isLoadingService || !hasCopiedService
            }
            onClick={handlePasteService}
            style={{
              padding: "12px 16px",
              width: "100%",
              color: "#ffffff",
              border: "none",
              borderRadius: 18,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              backgroundColor: "#111827"
            }}>
            Pegar servicio
          </button>
        </div>
      )}
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: "white",
          textAlign: "center"
        }}>
        {status}
      </p>
    </div>
  )
}

export default Popup
