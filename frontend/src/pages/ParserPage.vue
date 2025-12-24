<template>
  <q-page padding class="pdf-page">
    <MainContainer>
      <div class="row q-col-gutter-xl">
        <!-- LEFT PANEL -->
        <div class="col-6">
          <!-- HEADER INFO -->
          <q-banner rounded class="q-pa-none">
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
                  :error="deliveryDateError.length > 0"
                  :error-message="deliveryDateError"
                >
                  <template #append>
                    <q-icon name="event" class="cursor-pointer">
                      <q-popup-proxy ref="deliveryDatePopup" cover>
                        <q-date
                          v-model="header.DeliveryDate"
                          mask="YYYY-MM-DD"
                          @update:model-value="onDeliveryDateSelected"
                        />
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
                  <!-- <template #append>
                    <q-icon name="event" class="cursor-pointer">
                      <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                        <q-date v-model="header.PostingDate" mask="YYYY-MM-DD" />
                      </q-popup-proxy>
                    </q-icon>
                  </template> -->
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
        <div class="col-6" :class="{ 'disabled-panel': !isCustomerReady }">
          <q-banner v-if="!isCustomerReady" dense class="bg-grey-3 text-grey-8 q-mb-sm">
            Please select a customer before extracting a PDF.
          </q-banner>

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
                :disable="!isCustomerReady"
              />

              <q-file
                v-model="pdfFile"
                filled
                bottom-slots
                label="Upload PDF"
                counter
                :disable="!isCustomerReady"
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
                class="btn-primary-action q-ma-md"
                icon="search"
                :loading="loading"
                :disable="!isCustomerReady || !pdfFile || !templateName"
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
          <q-card class="clean-card q-mt-md">
            <q-card-section class="row items-center justify-between">
              <div class="header-section">
                <div class="section-title">
                  <q-icon name="inventory_2" size="18px" /> Customer PDF Table
                </div>
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

            <q-slide-transition>
              <div v-show="showRawTable">
                <q-card-section class="q-pa-none">
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
                    class="clean-table erp-table"
                    v-model:pagination="rawPagination"
                    :rows-per-page-options="rowsPerPageOptions"
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
          <q-banner rounded class="bg-grey-1">
            <div class="row q-col-gutter-md items-center text-body2">
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
              <div class="col-auto"><q-badge color="grey" /> SAP Item Not Found</div>
            </div>
          </q-banner>
        </div>
      </div>

      <q-separator />
      <!-- ================== MAPPED ERP TABLE ================== -->
      <div class="row">
        <div class="col-12">
          <q-banner rounded class="bg-grey-1">
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
          <q-card class="clean-card q-mt-md">
            <q-card-section class="row items-center justify-between">
              <div class="header-section">
                <div class="section-title">
                  <q-icon name="account_tree" size="18px" /> Mapped ERP Table
                </div>
                <div class="text-caption text-grey-6">Standardized schema</div>
              </div>
            </q-card-section>

            <q-separator />

            <q-card-section class="q-pa-none">
              <q-table
                :key="`${enrichedRows.length}-${showOnlyBlocked}`"
                :columns="mappedColumns"
                :rows="filteredRows"
                row-key="Barcode"
                sticky-header
                dense
                flat
                bordered
                v-model:pagination="erpPagination"
                :rows-per-page-options="rowsPerPageOptions"
                separator="horizontal"
                :row-class="erpRowClass"
                class="clean-table erp-table"
              >
                <!-- SAP ACTIVE -->
                <template #body-cell-SAPActive="props">
                  <q-td :props="props">
                    <div class="flex flex-center">
                      <q-badge
                        :color="
                          props.row.SAPStatus === 'ACTIVE'
                            ? 'green'
                            : props.row.SAPStatus === 'INACTIVE'
                              ? 'red'
                              : 'grey'
                        "
                        text-color="white"
                        class="q-px-sm"
                      >
                        {{
                          props.row.SAPStatus === 'ACTIVE'
                            ? 'ACTIVE'
                            : props.row.SAPStatus === 'INACTIVE'
                              ? 'INACTIVE'
                              : 'NOT FOUND'
                        }}
                      </q-badge>
                    </div>
                  </q-td>
                </template>

                <!-- PRICELIST STATUS -->
                <template #body-cell-PricelistStatus="props">
                  <q-td :props="props">
                    <div class="flex flex-center">
                      <!-- OK -->
                      <q-badge
                        v-if="props.row.PricelistStatus === 'PRICELIST_EXISTS'"
                        color="green"
                        text-color="white"
                        class="q-px-sm"
                      >
                        OK
                      </q-badge>

                      <!-- MISSING -->
                      <q-badge
                        v-else-if="props.row.PricelistStatus === 'NO_PRICELIST'"
                        color="red"
                        text-color="white"
                        class="q-px-sm"
                      >
                        NO PRICE
                      </q-badge>

                      <!-- ITEM NOT FOUND / UNKNOWN -->
                      <q-badge v-else color="grey" text-color="white" class="q-px-sm">
                        N/A
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
                        v-else-if="
                          props.row.NotPostToSAP === true || props.row.SAPStatus !== 'ACTIVE'
                        "
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
            :disable="
              saving || enrichedRows.length === 0 || postingToSap || deliveryDateError.length > 0
            "
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

const deliveryDatePopup = ref(null)
const deliveryDateError = ref('')

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
  DeliveryDate: null,
  PostingDate: todayISO(),
  PostedBy: '',
  confirmed: 'tYES',
  Pricelist: '',
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

const postingToSap = ref(false)

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
  {
    name: 'PricelistStatus',
    label: 'Pricelist',
    field: 'PricelistStatus',
    align: 'center',
  },
  { name: 'SAPActive', label: 'SAP Status', field: 'SAPActive', align: 'center' },
  { name: 'NotPostToSAP', label: 'SAP Rules', field: 'NotPostToSAP', align: 'center' },
  { name: 'CanPostToSAP', label: 'SAP Posting', field: 'CanPostToSAP', align: 'center' },
]

// function rowClass(row) {
//   if (row.SAPActive === false) return 'row-sap-inactive'
//   if (row.NotPostToSAP === true) return 'row-business-blocked'
//   if (row.CanPostToSAP === true) return 'row-postable'
//   return ''
// }

const rawPagination = ref({
  page: 1,
  rowsPerPage: 0, // ALL default
})

const erpPagination = ref({
  page: 1,
  rowsPerPage: 0, // ALL default
})

const rowsPerPageOptions = [0, 10, 25, 50, 100]

const errorSummary = computed(() => {
  const summary = {
    inactive: 0,
    noItem: 0,
    noStock: 0,
    insufficientStock: 0,
  }

  for (const row of enrichedRows.value) {
    if (row.SAPStatus === 'INACTIVE') {
      summary.inactive++
      continue
    }

    if (row.SAPStatus === 'NOT_FOUND') {
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

watch(
  () => header.value.CustomerCode,
  () => {
    templateName.value = null
    pdfFile.value = null
    rawRows.value = []
    rawColumns.value = []
    enrichedRows.value = []
  },
)
const isCustomerReady = computed(() => {
  return (
    !!header.value.CustomerCode &&
    !!header.value.CustomerName &&
    !!header.value.PostingDate &&
    !!header.value.DeliveryDate
  )
})

/* ================== HELPERS ================== */

function onDeliveryDateSelected(date) {
  validateDeliveryDate(date)
  deliveryDatePopup.value?.hide()
}

function validateDeliveryDate(date) {
  if (!date || !header.value.PostingDate) {
    deliveryDateError.value = ''
    return
  }

  if (date < header.value.PostingDate) {
    deliveryDateError.value = 'Delivery Date must be the same as or later than Posting Date'
  } else {
    deliveryDateError.value = ''
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function getBlockReason(row) {
  if (row.StockQty <= 0) return 'No stock available'
  if (row.StockQty < row.Qty) return 'Insufficient stock'
  if (row.PricelistStatus === 'NO_PRICELIST') return 'No price defined for customer pricelist'
  return 'Business rules OK'
}

// function fixDate(input) {
//   if (!input) return null
//   const s = String(input).trim()

//   if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

//   let m = s.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/)
//   if (m) return `${m[3]}-${m[2]}-${m[1]}`

//   m = s.match(/^(\d{4})[./-](\d{2})[./-](\d{2})$/)
//   if (m) return `${m[1]}-${m[2]}-${m[3]}`

//   const d = new Date(s)
//   return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
// }

const filteredRows = computed(() => {
  if (!showOnlyBlocked.value) return enrichedRows.value

  return enrichedRows.value.filter(
    (r) => !r.CanPostToSAP, // includes SAP inactive + business blocked
  )
})

function erpRowClass(row) {
  // 🔴 NOT FOUND or INACTIVE = highest priority
  if (row.SAPStatus !== 'ACTIVE') {
    return 'row-sap-inactive'
  }

  // 🟠 Business rule blocked
  if (row.NotPostToSAP === true) {
    return 'row-business-blocked'
  }

  // 🟢 Fully postable
  if (row.CanPostToSAP === true) {
    return 'row-postable'
  }

  // ⚪ Neutral / not evaluated
  return ''
}

/* ================== LOAD CUSTOMER LIST ================== */

onMounted(async () => {
  // set posted by with username.value from local storage
  header.value.PostedBy = localStorage.getItem('username') || 'SYSTEM'

  try {
    const res = await api.get('/api/customers/codes')
    console.log(res.data.rows)
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
    header.value.Pricelist = res.data.row?.Pricelist ?? 0
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

    const postQty = Number(row.PostQty ?? 0)

    if (postQty <= 0) {
      console.log('⛔ SKIPPED (INVALID POST QTY)', {
        Barcode: row.Barcode,
        PostQty: row.PostQty,
        StockQty: row.StockQty,
      })
      continue
    }

    sapLines.push({
      ItemCode: row.ItemCode,
      Quantity: postQty, // ✅ FINAL, RULED QUANTITY
    })

    console.log('✅ SAP LINE READY', {
      ItemCode: row.ItemCode,
      Quantity: postQty,
    })
  }

  return {
    CardCode: header.value.CustomerCode,
    DocDueDate: header.value.DeliveryDate,
    DocDate: header.value.PostingDate,
    TaxDate: header.value.PostingDate,
    NumAtCard: header.value.PONumber,
    Confirmed: header.value.confirmed,
    DocumentLines: sapLines,
  }
}

/* ================== SEND TO SAP ================== */

async function sendToSap() {
  const sapPayload = buildSapPayload()

  // ⛔ Nothing to post
  if (sapPayload.DocumentLines.length === 0) {
    return $q.notify({
      type: 'warning',
      message: 'No valid lines to post to SAP.',
    })
  }

  postingToSap.value = true

  // 🔄 SHOW SPINNER NOTIFICATION (AUTO-DISMISS)
  const dismissLoader = $q.notify({
    message: 'Posting to SAP…',
    color: 'info',
    spinner: true,
    timeout: 0, // stay until dismissed
    position: 'top',
    group: false,
  })

  try {
    const res = await api.post('/api/sap/post', sapPayload)

    // 🔥 HARD FAIL ON SAP BUSINESS ERROR
    if (!res.data?.success) {
      throw { response: { data: res.data } }
    }

    const docNum = res.data?.sapResponse?.DocNum

    // ✅ DISMISS LOADER
    dismissLoader()

    // ✅ SUCCESS NOTIFICATION
    $q.notify({
      type: 'positive',
      message: `Posting to SAP successful! DocNum: ${docNum ?? 'N/A'}`,
      timeout: 6000,
    })
  } catch (err) {
    // ✅ DISMISS LOADER
    dismissLoader()

    const message = extractSapMessage(err?.response?.data, err)

    // ❌ ERROR NOTIFICATION
    $q.notify({
      type: 'negative',
      message,
      timeout: 8000,
      multiLine: true,
    })
  } finally {
    postingToSap.value = false
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

          // ✅ REQUIRED FLAGS
          SAPActive: row.SAPActive,
          PricelistStatus: row.PricelistStatus,
          CanPostToSAP: row.CanPostToSAP,
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
  enrichedRows.value = []

  try {
    const form = new FormData()

    form.append('pdf', pdfFile.value)
    form.append('template', templateName.value)

    // ✅ BIND CUSTOMER CONTEXT
    form.append('customerCode', header.value.CustomerCode || '')
    form.append('pricelist', header.value.Pricelist || '')

    const res = await api.post('/api/extract', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    const json = res.data
    if (!json.success) throw new Error(json.message)

    const h = json.header || {}

    header.value.PONumber = h.PONumber || ''
    // ✅ NEW: Order Date from PDF (fallback safe)
    if (h.OrderDate) {
      header.value.OrderDate = h.OrderDate
    }
    rawColumns.value = json.columnsRaw || []
    rawRows.value = json.rawRows || []

    // ✅ ENRICHED ROWS NOW PRICELIST-AWARE
    enrichedRows.value = json.enrichedRows || []

    $q.notify({
      type: 'positive',
      message: 'PDF extracted successfully!',
    })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed: ' + err.message,
    })
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

.q-btn {
  border-radius: 9px;
}

.row-blocked td,
.row-blocked {
  background-color: #ffebee !important;
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
.disabled-panel {
  opacity: 0.5;
  pointer-events: none;
}

.extract-btn {
  color: #fff5f5;
  font-weight: 500;
  font-size: 1rem;
  text-transform: none;

  padding: 0 1rem !important;
  border-radius: 4px !important;
  font-weight: 600;
  background: linear-gradient(135deg, #10b981, #059669);
  box-shadow: 0 8px 16px rgba(16, 185, 129, 0.25);
}

.upload-box {
  border: 2px dashed #c7d2fe;
  border-radius: 12px;
  background: #f8fafc;
  padding: 24px;
  text-align: center;
}

.date-field:hover .icon {
  opacity: 1;
}

.label {
  font-size: 12px;
  color: #6b7280;
}

.value {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}
</style>
