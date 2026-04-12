import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export function roleGuard(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
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
