"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleGuard = roleGuard;
function roleGuard(allowedRoles) {
    return (req, res, next) => {
        const userRole = req.user?.role;
        if (!userRole || !allowedRoles.includes(userRole)) {
            res.status(403).json({
                error: `Access denied. This endpoint requires one of: ${allowedRoles.join(', ')}`,
            });
            return;
        }
        next();
    };
}
