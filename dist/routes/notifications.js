"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// FCM token registration is handled by PATCH /api/auth/fcm-token
// This route file is kept for future notification-related endpoints.
exports.default = router;
