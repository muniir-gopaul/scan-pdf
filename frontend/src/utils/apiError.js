export function extractApiError(err, resData) {
  // 1️⃣ SAP business error (most important)
  if (resData?.error?.message?.value) {
    return resData.error.message.value
  }

  // 2️⃣ Backend message
  if (resData?.message) {
    return resData.message
  }

  // 3️⃣ Axios error response
  if (err?.response?.data?.error?.message?.value) {
    return err.response.data.error.message.value
  }

  if (err?.response?.data?.message) {
    return err.response.data.message
  }

  // 4️⃣ Fallback
  return err?.message || 'Operation failed'
}
