import QRCode from "qrcode"

/** Генерирует PNG буфер QR кода для PULSE offer */
export async function generateOfferQr(token: string): Promise<Buffer> {
  const url = `pulse://offer/${token}`
  return QRCode.toBuffer(url, {
    errorCorrectionLevel: "M",
    width: 400,
    margin: 2,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  })
}
