/**
 * RF-12: utilidades de Facturación Electrónica SRI Ecuador (esquema offline, comprobante factura v1.1.0).
 * Genera la clave de acceso (49 dígitos, módulo 11) y el XML del comprobante listo para firmar con XAdES-BES.
 * La firma con el certificado .p12 y el envío a los web services del SRI se hacen con el servicio de firma
 * del proveedor elegido (ver README: SRI_SIGNER_URL); aquí se deja el comprobante y su estado.
 */
export function mod11(digits: string) {
  let factor = 2;
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const dv = 11 - (sum % 11);
  return dv === 11 ? 0 : dv === 10 ? 1 : dv;
}

export function accessKey(p: {
  date: Date; docType?: string; ruc: string; ambiente: '1' | '2'; establecimiento: string; puntoEmision: string; secuencial: number; numericCode?: string; offsetH?: number;
}) {
  const local = new Date(p.date.getTime() + (p.offsetH ?? -5) * 3600000);
  const dd = String(local.getUTCDate()).padStart(2, '0');
  const mm = String(local.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = local.getUTCFullYear();
  const ruc = p.ruc.replace(/\D/g, '').padStart(13, '0').slice(0, 13);
  const numeric = (p.numericCode ?? String(Math.floor(Math.random() * 1e8))).padStart(8, '0').slice(0, 8);
  const base = `${dd}${mm}${yyyy}${p.docType ?? '01'}${ruc}${p.ambiente}${p.establecimiento.padStart(3, '0')}${p.puntoEmision.padStart(3, '0')}${String(p.secuencial).padStart(9, '0')}${numeric}1`;
  return base + mod11(base);
}

export function isValidAccessKey(key: string) {
  return /^\d{49}$/.test(key) && mod11(key.slice(0, 48)) === Number(key[48]);
}

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n: any) => Number(n ?? 0).toFixed(2);

/** Tipo de identificación del comprador según tabla 6 de la ficha técnica SRI. */
export function buyerIdType(documentType: string, documentNumber: string) {
  if (documentType === 'RUC' || /^\d{13}$/.test(documentNumber)) return '04';
  if (documentType === 'CEDULA' && /^\d{10}$/.test(documentNumber)) return '05';
  if (documentType === 'PASAPORTE') return '06';
  return '07'; // consumidor final
}

/** Formas de pago SRI (tabla 24). */
export function paymentCode(method: string) {
  return { CASH: '01', CARD: '19', TRANSFER: '20', CHECK: '20', INSURANCE: '20', OTHER: '20' }[method] ?? '20';
}

export function buildInvoiceXml(p: {
  accessKey: string; ambiente: string; razonSocial: string; nombreComercial?: string; ruc: string; dirMatriz: string;
  establecimiento: string; puntoEmision: string; secuencial: number; fechaEmision: Date; obligadoContabilidad: boolean;
  buyer: { idType: string; id: string; name: string; address?: string; email?: string };
  items: { code?: string; description: string; quantity: number; unitPrice: number; total: number }[];
  payments: { method: string; amount: number }[];
  subtotal: number; total: number; offsetH?: number;
}) {
  const local = new Date(p.fechaEmision.getTime() + (p.offsetH ?? -5) * 3600000);
  const fecha = `${String(local.getUTCDate()).padStart(2, '0')}/${String(local.getUTCMonth() + 1).padStart(2, '0')}/${local.getUTCFullYear()}`;
  const pagos = p.payments.length ? p.payments : [{ method: 'OTHER', amount: p.total }];
  return `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${p.ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${esc(p.razonSocial)}</razonSocial>
    <nombreComercial>${esc(p.nombreComercial || p.razonSocial)}</nombreComercial>
    <ruc>${esc(p.ruc)}</ruc>
    <claveAcceso>${p.accessKey}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${p.establecimiento}</estab>
    <ptoEmi>${p.puntoEmision}</ptoEmi>
    <secuencial>${String(p.secuencial).padStart(9, '0')}</secuencial>
    <dirMatriz>${esc(p.dirMatriz)}</dirMatriz>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${fecha}</fechaEmision>
    <dirEstablecimiento>${esc(p.dirMatriz)}</dirEstablecimiento>
    <obligadoContabilidad>${p.obligadoContabilidad ? 'SI' : 'NO'}</obligadoContabilidad>
    <tipoIdentificacionComprador>${p.buyer.idType}</tipoIdentificacionComprador>
    <razonSocialComprador>${esc(p.buyer.name)}</razonSocialComprador>
    <identificacionComprador>${esc(p.buyer.id)}</identificacionComprador>
    <direccionComprador>${esc(p.buyer.address || 'S/N')}</direccionComprador>
    <totalSinImpuestos>${money(p.subtotal)}</totalSinImpuestos>
    <totalDescuento>0.00</totalDescuento>
    <totalConImpuestos>
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>0</codigoPorcentaje>
        <baseImponible>${money(p.subtotal)}</baseImponible>
        <valor>0.00</valor>
      </totalImpuesto>
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${money(p.total)}</importeTotal>
    <moneda>DOLAR</moneda>
    <pagos>
${pagos.map((pg) => `      <pago>
        <formaPago>${paymentCode(pg.method)}</formaPago>
        <total>${money(pg.amount)}</total>
      </pago>`).join('\n')}
    </pagos>
  </infoFactura>
  <detalles>
${p.items.map((it, i) => `    <detalle>
      <codigoPrincipal>${esc(it.code || `SERV${String(i + 1).padStart(3, '0')}`)}</codigoPrincipal>
      <descripcion>${esc(it.description)}</descripcion>
      <cantidad>${Number(it.quantity).toFixed(2)}</cantidad>
      <precioUnitario>${money(it.unitPrice)}</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>${money(it.total)}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>0</codigoPorcentaje>
          <tarifa>0</tarifa>
          <baseImponible>${money(it.total)}</baseImponible>
          <valor>0.00</valor>
        </impuesto>
      </impuestos>
    </detalle>`).join('\n')}
  </detalles>
  <infoAdicional>
${p.buyer.email ? `    <campoAdicional nombre="Email">${esc(p.buyer.email)}</campoAdicional>\n` : ''}    <campoAdicional nombre="Observacion">Servicios de salud odontológica - IVA 0%</campoAdicional>
  </infoAdicional>
</factura>`;
}
