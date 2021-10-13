import { createHmac } from 'crypto';

export const DEBUG_ACTIVE = process.env.NODE_ENV !== 'production';

export const crypt = (text: string): string => {
	return createHmac('sha256', process.env.SECRET).update(text).digest('hex');
};

export const isRightUser = (user?: string | null): boolean => {
	return !!user && user === crypt(process.env.BBVA_USER);
};
