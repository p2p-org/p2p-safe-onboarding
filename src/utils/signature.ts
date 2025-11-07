import { Hex, hexToBigInt, hexToBytes, padHex, toHex } from 'viem'

export interface SignatureParts {
  r: Hex
  s: Hex
  v: number
}

export const splitSignature = (signature: Hex): SignatureParts => {
  const normalized = signature.length === 132 ? signature : padHex(signature, { size: 64 })
  const bytes = hexToBytes(normalized)
  if (bytes.length !== 65) {
    throw new Error(`Invalid signature length: expected 65 bytes, received ${bytes.length}`)
  }
  const r = toHex(bytes.slice(0, 32))
  const s = toHex(bytes.slice(32, 64))
  let v = Number(bytes[64])
  if (v < 27) {
    v += 27
  }
  return { r, s, v }
}

export const joinSignature = ({ r, s, v }: SignatureParts): Hex => {
  if (v !== 27 && v !== 28) {
    throw new Error(`Invalid recovery id: expected 27 or 28, received ${v}`)
  }
  const vHex = toHex(v)
  return (`0x${r.slice(2)}${s.slice(2)}${vHex.slice(2).padStart(2, '0')}`) as Hex
}

export const normalizeSignature = (signature: Hex): Hex => joinSignature(splitSignature(signature))

