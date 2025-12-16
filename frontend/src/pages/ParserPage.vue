<template>
  <q-page padding>
    <MainContainer>
      <div class="row q-col-gutter-xl">
        <!-- LEFT PANEL -->
        <div class="col-6">
          <!-- HEADER INFO -->
          <div class="q-mb-md">
            <q-banner rounded class="text-dark q-pa-sm">
              <!-- CUSTOMER SELECT -->
              <q-select
                outlined
                dense
                v-model="selectedCustomerCode"
                :options="customerOptions"
                label="Customer Code"
                emit-value
                map-options
                @update:model-value="loadCustomerName"
                class="q-mb-sm"
              />

              <!-- GRID OF READONLY ERP FIELDS -->
              <div class="row q-col-gutter-sm">
                <!-- Customer Code -->
                <div class="col-6">
                  <q-input
                    outlined
                    dense
                    readonly
                    v-model="header.CustomerCode"
                    label="Customer Code"
                  />
                </div>

                <!-- Customer Name -->
                <div class="col-6">
                  <q-input
                    outlined
                    dense
                    readonly
                    v-model="header.CustomerName"
                    label="Customer Name"
                  />
                </div>

                <!-- PO Number -->
                <div class="col-6">
                  <q-input outlined dense readonly v-model="header.PONumber" label="PO Number" />
                </div>

                <!-- Order Date -->
                <div class="col-6">
                  <q-input outlined dense readonly v-model="header.OrderDate" label="Order Date" />
                </div>

                <!-- Delivery Date -->
                <div class="col-6">
                  <q-input
                    outlined
                    dense
                    readonly
                    v-model="header.DeliveryDate"
                    label="Delivery Date"
                  />
                </div>

                <!-- Posting Date (NEW) -->
                <div class="col-6">
                  <q-input
                    outlined
                    dense
                    v-model="header.PostingDate"
                    label="Posting Date"
                    mask="####-##-##"
                    readonly
                  >
                    <template #append>
                      <q-icon name="event" class="cursor-pointer">
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                          <q-date v-model="header.PostingDate" mask="YYYY-MM-DD" />
                        </q-popup-proxy>
                      </q-icon>
                    </template>
                  </q-input>

                  <q-input outlined dense readonly v-model="header.confirmed" label="Confirmed" />
                </div>

                <!-- Posted By (NEW) -->
                <div class="col-6">
                  <q-input outlined dense readonly v-model="header.PostedBy" label="Posted By" />
                </div>
              </div>
            </q-banner>
          </div>
        </div>
        <div class="col-6">
          <!-- PDF UPLOAD + TEMPLATE -->
          <q-card flat bordered class="q-pa-md">
            <q-card-section>
              <div class="text-h6">📄 PDF Data Extraction</div>
              <div class="text-caption text-grey-7">Upload your PDF and extract table data</div>
            </q-card-section>

            <q-separator />

            <q-card-section class="q-gutter-md">
              <q-select
                outlined
                dense
                v-model="templateName"
                :options="templateOptions"
                label="Extraction Template"
                emit-value
                map-options
              />

              <q-file
                v-model="pdfFile"
                filled
                bottom-slots
                label="Upload PDF"
                counter
                @update:model-value="validateFile"
              >
                <template #prepend>
                  <q-icon name="cloud_upload" />
                </template>
                <template #append>
                  <q-icon
                    name="close"
                    class="cursor-pointer"
                    @click.stop.prevent="pdfFile = null"
                  />
                </template>
              </q-file>
            </q-card-section>

            <q-card-actions align="right">
              <q-btn label="Reset" flat color="grey" @click="resetForm" />
              <q-btn
                label="Extract"
                color="secondary"
                icon="search"
                :loading="loading"
                :disable="!pdfFile || !templateName"
                @click="extractPdf"
              />
            </q-card-actions>
          </q-card>
        </div>
      </div>
      <div class="row q-col-gutter-lg q-my-lg">
        <div class="col-6">
          <!-- RAW SUPPLIER TABLE -->
          <q-card bordered class="q-mb-lg">
            <q-card-section>
              <div class="text-h6">📃 SUPPLIER PDF TABLE</div>
              <div class="text-caption">
                Template: <b>{{ templateName }}</b>
              </div>
            </q-card-section>

            <q-separator />

            <q-card-section>
              <div v-if="loading" class="flex flex-center q-pa-xl">
                <q-spinner size="50px" color="secondary" />
              </div>

              <q-table
                v-else-if="rawRows.length > 0"
                :columns="rawColumns"
                :rows="rawRows"
                row-key="_id"
                dense
                flat
                bordered
              />

              <div v-else class="text-grey text-center q-pa-md">No raw data extracted yet.</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-6">
          <!-- MAPPED ERP TABLE -->
          <q-card bordered>
            <q-card-section>
              <div class="text-h6">📦 Mapped ERP Table</div>
              <div class="text-caption">Standardized schema</div>
            </q-card-section>

            <q-separator />

            <q-card-section>
              <q-table
                v-if="mappedRows.length > 0"
                :columns="mappedColumns"
                :rows="enrichedRows"
                row-key="Barcode"
                :row-class="getRowClass"
                dense
                flat
                bordered
              >
                <template #body-cell-NotPostToSAP="props">
                  <q-checkbox :model-value="isRowBlocked(props.row)" color="red" readonly />
                </template>
              </q-table>

              <div v-else class="text-grey text-center q-pa-md">No mapped data available.</div>
            </q-card-section>
          </q-card>

          <q-btn
            label="Save Document"
            color="primary"
            icon="save"
            class="q-mt-md"
            :loading="saving"
            :disable="saving || enrichedRows.length === 0"
            @click="saveDocument"
          />
        </div>
      </div>
    </MainContainer>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import MainContainer from 'src/components/MainContainer.vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()

/* ================== STATE ================== */

const templateName = ref(null)
const templateOptions = [
  { label: 'Dreamprice', value: 'dreamprice' },
  { label: 'Winners', value: 'winners' },
]

const pdfFile = ref(null)

/* ✅ HEADER IS NEVER NULL (CRASH FIX) */
const header = ref({
  CustomerCode: '',
  CustomerName: '',
  PONumber: '',
  OrderDate: '',
  DeliveryDate: '',
  PostingDate: null,
  PostedBy: '',
  confirmed: 'Yes',
})

// RAW
const rawColumns = ref([])
const rawRows = ref([])

// MAPPED
const mappedColumns = ref([])
const mappedRows = ref([])

// ENRICHED ROWS (FULL DATA USED FOR SAVING)
const enrichedRows = ref([])

const loading = ref(false)
const saving = ref(false)

// CUSTOMER SELECT
const selectedCustomerCode = ref(null)
const customerOptions = ref([])

function isRowBlocked(row) {
  const qty = Number(row.Qty ?? 0)
  const stock = Number(row.StockQty ?? 0)

  return !row.ItemCode || stock <= 0 || stock < qty
}

function getRowClass(row) {
  return isRowBlocked(row) ? 'row-blocked' : ''
}
function fixDate(input) {
  if (!input) return null

  const s = String(input).trim()

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  let m = s.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/)
  if (m) {
    const dd = m[1]
    const mm = m[2]
    const yyyy = m[3]

    return `${yyyy}-${mm}-${dd}`
  }

  // YYYY/MM/DD or YYYY.MM.DD or YYYY-MM-DD
  m = s.match(/^(\d{4})[./-](\d{2})[./-](\d{2})$/)
  if (m) {
    const yyyy = m[1]
    const mm = m[2]
    const dd = m[3]

    return `${yyyy}-${mm}-${dd}`
  }

  // Let JS try
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

/* ================== LOAD CUSTOMER LIST ================== */

onMounted(async () => {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/customers/codes`)
    const json = await res.json()
    console.log(json)
    customerOptions.value = json.rows.map((c) => ({
      label: `${c.CardCode} - ${c.CardName}`, // Combine code and name
      value: c.CardCode,
    }))
  } catch {
    $q.notify({ type: 'negative', message: 'Failed loading customer list' })
  }
})

/* ================== LOAD CUSTOMER NAME ================== */

const loadCustomerName = async (code) => {
  if (!code) return

  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/customers/${code}`)
    const json = await res.json()

    header.value.CustomerCode = code
    header.value.CustomerName = json.row?.CardName || 'Unknown'
  } catch {
    $q.notify({ type: 'negative', message: 'Customer lookup failed' })
  }
}

/* ============================================================
   BUILD SAP PAYLOAD (using enrichedRows and rules)
============================================================ */
function buildSapPayload() {
  const sapLines = []

  for (const row of enrichedRows.value) {
    const qty = Number(row.Qty ?? 0)
    const stock = Number(row.StockQty ?? 0)
    const checked = row.NotPostToSAP === true //  checkbox logic

    let postQty = 0

    if (!checked) {
      // CASE 1 → Checkbox UNCHECKED → Post full Qty
      if (qty > 0 && row.ItemCode) {
        postQty = qty
      }
    } else {
      // CASE 2 → Checkbox CHECKED → Special SAP rules
      if (!row.ItemCode) continue // Skip
      if (stock <= 0) continue // Skip

      if (stock > 0 && stock < qty) {
        postQty = stock // POST PARTIAL
      } else {
        continue // Skip
      }
    }

    // Add line if postQty > 0
    if (postQty > 0) {
      sapLines.push({
        ItemCode: row.ItemCode,
        Quantity: postQty,
      })
    }
  }

  return {
    CardCode: header.value.CustomerCode,
    DocDueDate: header.value.DeliveryDate,
    DocDate: header.value.PostingDate,
    TaxDate: header.value.OrderDate,
    NumAtCard: header.value.PONumber,
    Confirmed: header.value.confirmed,
    DocumentLines: sapLines,
  }
}

/* ============================================================
   SEND PAYLOAD TO SAP
============================================================ */
async function sendToSap() {
  const sapPayload = buildSapPayload()

  console.log('Processing row for SAP:', sapPayload.DocumentLines)
  console.log('🚀 SAP Payload:', sapPayload)

  // ------------------------
  // 1️⃣ MUST HAVE SAP COOKIES
  // ------------------------
  const sapCookies = localStorage.getItem('sapCookies')
  if (!sapCookies) {
    return $q.notify({
      type: 'negative',
      message: 'SAP session expired. Please login again.',
    })
  }

  if (sapPayload.DocumentLines.length === 0) {
    $q.notify({ type: 'warning', message: 'No valid lines to post to SAP.' })
    return
  }

  try {
    // ------------------------
    // 2️⃣ SEND COOKIES TO BACKEND
    // ------------------------
    const sapCookies = localStorage.getItem('sapCookies')

    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/sap/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sap-cookies': sapCookies, // ← must be raw string
      },
      body: JSON.stringify(sapPayload),
    })

    const json = await res.json()

    if (!json.success) throw new Error(json.message)

    $q.notify({
      type: 'positive',
      message: 'Posted to SAP successfully!',
    })
  } catch (err) {
    console.error('❌ SAP ERROR:', err)
    $q.notify({
      type: 'negative',
      message: 'SAP Posting Failed: ' + err.message,
    })
  }
}

/* ================== SAVE DOCUMENT ================== */
const saveDocument = () => {
  $q.dialog({
    title: 'Confirm Save',
    message: 'Are you sure you want to save this document and all line items?',
    cancel: true,
    ok: {
      label: 'Save',
      color: 'primary',
    },
  }).onOk(async () => {
    try {
      saving.value = true

      // Validate header
      if (!header.value.CustomerCode) {
        saving.value = false
        return $q.notify({
          type: 'negative',
          message: 'Customer Code is mandatory',
        })
      }

      // Validate lines
      if (!enrichedRows.value || enrichedRows.value.length === 0) {
        saving.value = false
        return $q.notify({
          type: 'negative',
          message: 'No lines to save',
        })
      }

      console.log('🔥 Sending enriched rows:', enrichedRows.value[0])

      // Build payload
      const payload = {
        header: {
          CustomerCode: header.value.CustomerCode,
          CustomerName: header.value.CustomerName,
          PONumber: header.value.PONumber,
          OrderDate: header.value.OrderDate,
          DeliveryDate: header.value.DeliveryDate,

          PostingDate: header.value.PostingDate,
          PostedBy: header.value.PostedBy || 'SYSTEM',
        },

        // FULL DATA from enrichment (NOT UI table)
        lines: enrichedRows.value.map((row) => ({
          ItemCode: row.ItemCode,
          Description: row.DBDescription || row.Description,
          Barcode: row.Barcode,

          // Correct quantity
          Quantity: row.Qty || 0,

          // UNIT PRICE MUST BE BLANK
          UnitPrice: null,

          // PU(HT) goes into POPRICE
          POPrice: row.UnitPrice || 0,

          // Stock
          StockQty: row.StockQty || 0,
        })),
      }

      console.log('📦 Payload to backend:', payload)

      // Send to API
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/pdf/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      saving.value = false

      if (!json.success) throw new Error(json.message)

      $q.notify({
        type: 'positive',
        message: `Saved successfully! DocEntry: ${json.docEntry}, DocNum: ${json.docNum}`,
      })

      // SAP POSTING PROMPT
      $q.dialog({
        title: 'Post to SAP?',
        message: 'Do you want to send this document to SAP now?',
        cancel: true,
        ok: { label: 'Post', color: 'primary' },
      }).onOk(() => {
        sendToSap()
      })
    } catch (err) {
      saving.value = false
      console.error('❌ SAVE ERROR:', err)
      $q.notify({
        type: 'negative',
        message: 'Save failed: ' + err.message,
      })
    }
  })
}

/* ================== FILE VALIDATION ================== */

const validateFile = (file) => {
  if (file && file.type !== 'application/pdf') {
    $q.notify({ type: 'negative', message: 'Only PDF files allowed' })
    pdfFile.value = null
  }
}

/* ================== EXTRACT PDF ================== */

const extractPdf = async () => {
  loading.value = true

  rawRows.value = []
  rawColumns.value = []
  mappedRows.value = []
  mappedColumns.value = []
  enrichedRows.value = []

  try {
    const form = new FormData()
    form.append('pdf', pdfFile.value)
    form.append('template', templateName.value)

    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/extract`, {
      method: 'POST',
      body: form,
    })
    const json = await res.json()
    console.log(json)

    if (!json.success) throw new Error(json.message)

    const h = json.header || {}

    header.value.PONumber = h.PONumber || ''

    header.value.OrderDate = fixDate(h.OrderDate)
    header.value.DeliveryDate = fixDate(h.DeliveryDate)
    header.value.PostingDate = h.PostingDate || null

    header.value.PostedBy = h.PostedBy || 'SYSTEM'

    rawColumns.value = json.columnsRaw || []
    rawRows.value = json.rawRows || []

    mappedColumns.value = json.columnsMapped || []
    mappedRows.value = json.mappedRows || []

    // STORE FULL ENRICHED ROWS (for saving)
    enrichedRows.value = json.enrichedRows || json.mappedRows || []
    console.log('🔥 enrichedRows received:', enrichedRows.value.length, enrichedRows.value[0])

    $q.notify({ type: 'positive', message: 'PDF extracted successfully!' })
  } catch (err) {
    $q.notify({ type: 'negative', message: 'Failed: ' + err.message })
  } finally {
    loading.value = false
  }
}

/* ================== RESET ================== */

function resetForm() {
  templateName.value = null
  pdfFile.value = null

  header.value = {
    CustomerCode: '',
    CustomerName: '',
    PONumber: '',
    OrderDate: '',
    DeliveryDate: '',
    PostingDate: null,
    PostedBy: '',
  }

  rawRows.value = []
  rawColumns.value = []

  mappedRows.value = []
  mappedColumns.value = []
  enrichedRows.value = []
}
</script>

<style>
.pdf-page {
  background: linear-gradient(120deg, #f5f7fa, #e4ecf7);
  min-height: 100vh;
}

.glass-card {
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  backdrop-filter: blur(10px);
}

.header-card {
  background: linear-gradient(135deg, #e3f2fd, #ffffff);
  border-radius: 12px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 14px;
  font-size: 13px;
}

.pretty-table {
  border-radius: 10px;
  overflow: hidden;
}

.pretty-table thead tr {
  background: #f0f4ff;
  font-weight: 600;
}

.q-btn {
  border-radius: 9px;
}

.row-blocked td,
.row-blocked {
  background-color: #ffebee !important;
}
</style>
