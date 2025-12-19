<template>
  <q-page padding>
    <MainContainer>
      <div class="row q-col-gutter-xl">
        <!-- LEFT PANEL -->
        <div class="col-6">
          <!-- HEADER INFO -->
          <q-banner rounded class="header-card q-pa-none">
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
                  v-model="header.DeliveryDate"
                  label="Delivery Date"
                  mask="####-##-##"
                  readonly
                >
                  <template #append>
                    <q-icon name="event" class="cursor-pointer">
                      <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                        <q-date v-model="header.DeliveryDate" mask="YYYY-MM-DD" />
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>
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
              </div>
              <!-- Confirmed field set to YES by default -->
              <div class="col-6">
                <!-- <q-input outlined dense readonly v-model="header.confirmed" label="Confirmed" /> -->
              </div>
              <!-- Posted By (NEW) -->
              <div class="col-6">
                <q-input outlined dense readonly v-model="header.PostedBy" label="Posted By" />
              </div>
            </div>
          </q-banner>
        </div>
        <div class="col-6">
          <!-- PDF UPLOAD + TEMPLATE -->
          <q-card flat bordered class="q-pa-none">
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

            <q-card-actions align="center">
              <!-- <q-btn label="Reset" flat color="grey" @click="resetForm" /> -->
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
    </MainContainer>
    <MainContainer>
      <!-- ================== RAW SUPPLIER TABLE ================== -->
      <div class="row">
        <div class="col-12">
          <q-card class="glass-card no-shadow">
            <q-card-section class="row items-center justify-between">
              <div>
                <div class="text-h6">📃 Supplier PDF Table</div>
                <div class="text-caption text-grey">
                  Template: <b>{{ templateName }}</b>
                </div>
              </div>

              <q-btn
                flat
                dense
                :icon="showRawTable ? 'expand_less' : 'expand_more'"
                @click="showRawTable = !showRawTable"
                :label="showRawTable ? 'Hide' : 'Show'"
              />
            </q-card-section>

            <q-separator />

            <q-slide-transition>
              <div v-show="showRawTable">
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
                    class="pretty-table"
                  />

                  <div v-else class="text-grey text-center q-pa-md">No raw data extracted yet.</div>
                </q-card-section>
              </div>
            </q-slide-transition>
          </q-card>
        </div>
      </div>
    </MainContainer>
    <!-- ================== LEGEND + COUNTERS ================== -->
    <MainContainer>
      <div class="row">
        <div class="col-12">
          <q-banner dense class="glass-card q-mb-sm">
            <div class="row items-center q-col-gutter-md text-caption">
              <div class="col-auto"><q-badge color="green" /> SAP Active</div>
              <div class="col-auto"><q-badge color="red" /> SAP Inactive</div>

              <div class="col-auto">
                <q-icon name="check_circle" color="green" size="16px" />
                Business rules OK
              </div>

              <div class="col-auto">
                <q-icon name="block" color="red" size="16px" />
                Blocked by business rules
              </div>

              <div class="col-auto">
                <q-icon name="task_alt" color="green" size="16px" />
                SAP Posting: Allowed
              </div>

              <div class="col-auto">
                <q-icon name="cancel" color="red" size="16px" />
                SAP Posting: Blocked
              </div>
              <div class="col-auto">
                <q-icon name="cancel" color="red" size="16px" />
                Blocked — SAP inactive
              </div>
            </div>
          </q-banner>
        </div>
      </div>

      <!-- ================== MAPPED ERP TABLE ================== -->
      <div class="row">
        <div class="col-12">
          <q-banner dense class="glass-card q-mb-sm">
            <div class="row q-col-gutter-md text-caption">
              <div v-if="errorSummary.inactive" class="col-auto text-red">
                ⛔ {{ errorSummary.inactive }} inactive items in SAP
              </div>

              <div v-if="errorSummary.noItem" class="col-auto text-red">
                📦 {{ errorSummary.noItem }} items not mapped
              </div>

              <div v-if="errorSummary.noStock" class="col-auto text-orange">
                📉 {{ errorSummary.noStock }} items with no stock
              </div>

              <div v-if="errorSummary.insufficientStock" class="col-auto text-orange">
                ⚠ {{ errorSummary.insufficientStock }} insufficient stock
              </div>

              <div class="col-auto text-green">
                🧾 {{ postableLines }} / {{ totalLines }} lines will be posted to SAP
                <span v-if="showOnlyBlocked" class="text-grey"> — showing blocked only </span>
              </div>
              <div class="col-auto">
                <q-icon name="do_not_disturb" color="grey" size="16px" />
                Business rules not evaluated
              </div>
            </div>
          </q-banner>
        </div>

        <div class="col-12">
          <q-card bordered>
            <q-card-section>
              <div class="text-h6">📦 Mapped ERP Table</div>
              <div class="text-caption">Standardized schema</div>
            </q-card-section>

            <q-separator />

            <q-card-section>
              <q-table
                :key="`${enrichedRows.length}-${showOnlyBlocked}`"
                :columns="mappedColumns"
                :rows="filteredRows"
                row-key="Barcode"
                dense
                flat
                bordered
                separator="horizontal"
                :row-class="rowClass"
                class="pretty-table"
              >
                <!-- SAP ACTIVE -->
                <template #body-cell-SAPActive="props">
                  <q-td :props="props">
                    <div class="flex flex-center">
                      <q-badge
                        :color="props.row.SAPActive ? 'green' : 'red'"
                        text-color="white"
                        class="q-px-sm"
                      >
                        {{ props.row.SAPActive ? 'ACTIVE' : 'INACTIVE' }}
                      </q-badge>
                    </div>
                  </q-td>
                </template>

                <template #body-cell-NotPostToSAP="props">
                  <q-td :props="props">
                    <div class="flex flex-center">
                      <q-icon
                        v-if="props.row.NotPostToSAP === null"
                        name="do_not_disturb"
                        color="grey"
                        size="20px"
                      />
                      <q-icon
                        v-else-if="props.row.NotPostToSAP"
                        name="block"
                        color="red"
                        size="20px"
                      >
                        <q-tooltip>
                          {{ getBlockReason(props.row) }}
                        </q-tooltip>
                      </q-icon>
                      <q-icon v-else name="check_circle" color="green" size="20px" />
                    </div>
                  </q-td>
                </template>

                <template #body-cell-CanPostToSAP="props">
                  <q-td :props="props">
                    <div class="flex flex-center">
                      <q-icon
                        v-if="props.row.CanPostToSAP"
                        name="task_alt"
                        color="green"
                        size="22px"
                      />
                      <q-icon
                        v-else-if="props.row.NotPostToSAP === true || props.row.SAPActive === false"
                        name="cancel"
                        color="red"
                        size="22px"
                      />
                      <q-icon v-else name="do_not_disturb" color="grey" size="22px" />
                    </div>
                  </q-td>
                </template>
              </q-table>
            </q-card-section>
          </q-card>
          <q-btn
            icon="cloud_upload"
            color="light-blue-14"
            label="Submit"
            class="rounded-borders q-mt-md"
            :loading="saving"
            :disable="saving || enrichedRows.length === 0"
            @click="saveDocument"
            outline
          />
        </div>
      </div>
    </MainContainer>
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import MainContainer from 'src/components/MainContainer.vue'
import { useQuasar } from 'quasar'
import { api } from 'src/boot/axios'

const $q = useQuasar()

/* ================== COUNTERS ================== */

const totalLines = computed(() => enrichedRows.value.length)

const postableLines = computed(() => enrichedRows.value.filter((r) => r.CanPostToSAP).length)

/* ================== STATE ================== */

const templateName = ref(null)
const templateOptions = [
  { label: 'Dreamprice', value: 'dreamprice' },
  { label: 'Winners', value: 'winners' },
]

const pdfFile = ref(null)

/* ✅ HEADER IS NEVER NULL */
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
// const mappedRows = ref([])

// ENRICHED
const enrichedRows = ref([])

const loading = ref(false)
const saving = ref(false)

// CUSTOMER SELECT
const selectedCustomerCode = ref(null)
const customerOptions = ref([])

const showRawTable = ref(false)

const showOnlyBlocked = ref(false)

const mappedColumns = [
  { name: 'Barcode', label: 'Barcode', field: 'Barcode', align: 'left' },
  { name: 'ItemCode', label: 'Item Code', field: 'ItemCode', align: 'left' },
  { name: 'Description', label: 'PDF Description', field: 'Description', align: 'left' },
  { name: 'Qty', label: 'Qty', field: 'Qty', align: 'right' },
  { name: 'StockQty', label: 'Stock Qty', field: 'StockQty', align: 'center' },

  // 🔑 THESE MUST HAVE A FIELD
  { name: 'SAPActive', label: 'SAP Status', field: 'SAPActive', align: 'center' },
  { name: 'NotPostToSAP', label: 'SAP Rules', field: 'NotPostToSAP', align: 'center' },
  { name: 'CanPostToSAP', label: 'SAP Posting', field: 'CanPostToSAP', align: 'center' },
]

function rowClass(row) {
  if (row.SAPActive === false) return 'row-sap-inactive'
  if (row.NotPostToSAP === true) return 'row-business-blocked'
  if (row.CanPostToSAP === true) return 'row-postable'
  return ''
}

const errorSummary = computed(() => {
  const summary = {
    inactive: 0,
    noItem: 0,
    noStock: 0,
    insufficientStock: 0,
  }

  for (const row of enrichedRows.value) {
    if (!row.SAPActive) {
      summary.inactive++
      continue
    }

    if (!row.ItemCode) {
      summary.noItem++
      continue
    }

    if (row.StockQty <= 0) {
      summary.noStock++
      continue
    }

    if (row.StockQty < row.Qty) {
      summary.insufficientStock++
    }
  }

  return summary
})

watch(enrichedRows, () => {
  console.table(
    enrichedRows.value.map((r) => ({
      Barcode: r.Barcode,
      SAPActive: r.SAPActive,
      NotPostToSAP: r.NotPostToSAP,
      CanPostToSAP: r.CanPostToSAP,
    })),
  )
})

/* ================== HELPERS ================== */

function getBlockReason(row) {
  if (row.StockQty <= 0) return 'No stock available'
  if (row.StockQty < row.Qty) return 'Insufficient stock'
  return 'Business rules OK'
}

function fixDate(input) {
  if (!input) return null
  const s = String(input).trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  let m = s.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`

  m = s.match(/^(\d{4})[./-](\d{2})[./-](\d{2})$/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`

  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

const filteredRows = computed(() => {
  if (!showOnlyBlocked.value) return enrichedRows.value

  return enrichedRows.value.filter(
    (r) => !r.CanPostToSAP, // includes SAP inactive + business blocked
  )
})

/* ================== LOAD CUSTOMER LIST ================== */

onMounted(async () => {
  // set posted by with username.value from local storage
  header.value.PostedBy = localStorage.getItem('username') || 'SYSTEM'

  try {
    const res = await api.get('/api/customers/codes')
    customerOptions.value = res.data.rows.map((c) => ({
      label: `${c.CardCode} - ${c.CardName}`,
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
    const res = await api.get(`/api/customers/${code}`)
    header.value.CustomerCode = code
    header.value.CustomerName = res.data.row?.CardName || 'Unknown'
  } catch {
    $q.notify({ type: 'negative', message: 'Customer lookup failed' })
  }
}

/* ================== BUILD SAP PAYLOAD ================== */

function buildSapPayload() {
  const sapLines = []

  for (const row of enrichedRows.value) {
    /**
     * FINAL GATE — SINGLE SOURCE OF TRUTH
     *
     * A line is posted to SAP ONLY IF:
     * - Item exists
     * - Item is Active in SAP
     * - Business rules allow posting (NotPostToSAP === false)
     */
    if (!row.CanPostToSAP) {
      console.log('⛔ SKIPPED SAP LINE', {
        Barcode: row.Barcode,
        ItemCode: row.ItemCode,
        SAPActive: row.SAPActive,
        StockQty: row.StockQty,
        Qty: row.Qty,
        NotPostToSAP: row.NotPostToSAP,
      })
      continue
    }

    const qty = Number(row.Qty ?? 0)

    if (qty <= 0) {
      console.log('⛔ SKIPPED (INVALID QTY)', {
        Barcode: row.Barcode,
        Qty: row.Qty,
      })
      continue
    }

    sapLines.push({
      ItemCode: row.ItemCode,
      Quantity: qty,
    })

    console.log('✅ SAP LINE READY', {
      ItemCode: row.ItemCode,
      Quantity: qty,
    })
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

/* ================== SEND TO SAP ================== */

async function sendToSap() {
  const sapPayload = buildSapPayload()

  if (sapPayload.DocumentLines.length === 0) {
    return $q.notify({ type: 'warning', message: 'No valid lines to post to SAP.' })
  }

  try {
    const res = await api.post('/api/sap/post', sapPayload)
    // 🔥 MUST THROW ON BUSINESS FAILURE
    if (!res.data.success) {
      throw { response: { data: res.data } }
    }

    $q.notify({
      type: 'positive',
      message: 'Posted to SAP successfully!',
    })
  } catch (err) {
    console.error('❌ SAP ERROR:', err)

    const message = extractSapMessage(err?.response?.data, err)

    $q.notify({
      type: 'negative',
      message,
      timeout: 7000,
      multiLine: true,
    })
  }
}

/* ================== GET SAP ERROR MESSAGE ================== */

function extractSapMessage(resData, err) {
  // 1️⃣ SAP business error (your exact structure)
  if (resData?.sapResponse?.error?.message?.value) {
    return resData.sapResponse.error.message.value
  }

  // 2️⃣ Axios error response (if thrown)
  if (err?.response?.data?.sapResponse?.error?.message?.value) {
    return err.response.data.sapResponse.error.message.value
  }

  // 3️⃣ Backend message
  if (resData?.message) {
    return resData.message
  }

  // 4️⃣ Generic fallback
  return err?.message || 'Operation failed'
}

/* ================== SAVE DOCUMENT ================== */

const saveDocument = () => {
  $q.dialog({
    title: 'Confirm Save',
    message: 'Are you sure you want to save this document and all line items?',
    cancel: true,
    ok: { label: 'Save', color: 'primary' },
  }).onOk(async () => {
    try {
      saving.value = true

      if (!header.value.CustomerCode) {
        saving.value = false
        return $q.notify({ type: 'negative', message: 'Customer Code is mandatory' })
      }

      if (!enrichedRows.value.length) {
        saving.value = false
        return $q.notify({ type: 'negative', message: 'No lines to save' })
      }

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
        lines: enrichedRows.value.map((row) => ({
          ItemCode: row.ItemCode,
          Description: row.DBDescription || row.Description,
          Barcode: row.Barcode,
          Quantity: row.Qty || 0,
          UnitPrice: null,
          POPrice: row.UnitPrice || 0,
          StockQty: row.StockQty || 0,
        })),
      }

      const res = await api.post('/api/pdf/save', payload)
      if (!res.data.success) throw new Error(res.data.message)

      $q.notify({
        type: 'positive',
        message: `Saved successfully! DocEntry: ${res.data.docEntry}, DocNum: ${res.data.docNum}`,
      })

      $q.dialog({
        title: 'Post to SAP?',
        message: 'Do you want to send this document to SAP now?',
        cancel: true,
        ok: { label: 'Post', color: 'primary' },
      }).onOk(sendToSap)
    } catch (err) {
      $q.notify({ type: 'negative', message: 'Save failed: ' + err.message })
    } finally {
      saving.value = false
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
  // mappedRows.value = []
  // mappedColumns.value = []
  enrichedRows.value = []

  try {
    const form = new FormData()
    form.append('pdf', pdfFile.value)
    form.append('template', templateName.value)

    const res = await api.post('/api/extract', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    const json = res.data
    if (!json.success) throw new Error(json.message)

    const h = json.header || {}

    header.value.PONumber = h.PONumber || ''
    header.value.OrderDate = fixDate(h.OrderDate)
    header.value.DeliveryDate = fixDate(h.DeliveryDate)
    header.value.PostingDate = h.PostingDate || null

    rawColumns.value = json.columnsRaw || []
    rawRows.value = json.rawRows || []

    // mappedRows.value = json.mappedRows || []
    enrichedRows.value = json.enrichedRows || []

    $q.notify({ type: 'positive', message: 'PDF extracted successfully!' })
  } catch (err) {
    $q.notify({ type: 'negative', message: 'Failed: ' + err.message })
  } finally {
    loading.value = false
  }
}

/* ================== RESET ================== */

// function resetForm() {
//   templateName.value = null
//   pdfFile.value = null

//   header.value = {
//     CustomerCode: '',
//     CustomerName: '',
//     PONumber: '',
//     OrderDate: '',
//     DeliveryDate: '',
//     PostingDate: null,
//   }

//   rawRows.value = []
//   rawColumns.value = []
//   // mappedRows.value = []
//   // mappedColumns.value = []
//   enrichedRows.value = []
// }
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

.q-table tbody tr:hover {
  background-color: #f5f7fa;
}

/* SAP inactive */
.row-sap-inactive {
  background-color: #fdecea !important;
}

/* Business rule blocked */
.row-business-blocked {
  background-color: #fff4e5 !important;
}

/* Fully postable */
.row-postable {
  background-color: #e8f5e9 !important;
}

/* FORCE ROW BOTTOM BORDER TO CONTINUE ACROSS ALL COLUMNS */
.q-table tbody tr {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.q-table tbody tr:last-child {
  border-bottom: none;
}
</style>
