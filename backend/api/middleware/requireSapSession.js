module.exports = function requireSapSession(req, res, next) {
  const url = req.originalUrl || '';

  /**
   * 🔓 PUBLIC / NON-SAP ROUTES
   * These DO NOT require SAP authentication
   */
  const publicRoutes = [
    '/api/auth',
    '/api/extract',
    '/api/pdf',
    '/api/company',
    '/api/customers',
  ];

  if (publicRoutes.some((p) => url.startsWith(p))) {
    return next();
  }

  /**
   * 🔐 SAP ROUTES ONLY
   * SAP Service Layer authentication is cookie-based
   */
  const cookieHeader = req.headers['sap-cookies'] || req.headers.cookie;

  if (!cookieHeader || !cookieHeader.includes('B1SESSION')) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated with SAP',
    });
  }

  next();
};
