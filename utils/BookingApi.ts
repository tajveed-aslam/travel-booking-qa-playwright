import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { Booking } from './builders';
import { createdBookingSchema, tokenSchema, type CreatedBooking } from './schemas';

/**
 * Thin client for the Restful-Booker API. Methods return the raw APIResponse so tests can assert status codes and
 * bodies themselves; helpers that parse (createBooking, getToken) validate the response shape with zod first.
 */
export class BookingApi {
  constructor(private readonly request: APIRequestContext) {}

  auth(username: string, password: string): Promise<APIResponse> {
    return this.request.post('/auth', { data: { username, password } });
  }

  async getToken(username: string, password: string): Promise<string> {
    const res = await this.auth(username, password);
    expect(res.status()).toBe(200);
    return tokenSchema.parse(await res.json()).token;
  }

  create(data: unknown): Promise<APIResponse> {
    return this.request.post('/booking', { data });
  }

  async createBooking(booking: Booking): Promise<CreatedBooking> {
    const res = await this.create(booking);
    expect(res.status(), await res.text()).toBe(200);
    return createdBookingSchema.parse(await res.json());
  }

  get(id: number): Promise<APIResponse> {
    return this.request.get(`/booking/${id}`);
  }

  list(filters: Record<string, string> = {}): Promise<APIResponse> {
    return this.request.get('/booking', { params: filters });
  }

  update(id: number, data: unknown, token?: string): Promise<APIResponse> {
    return this.request.put(`/booking/${id}`, { data, headers: auth(token) });
  }

  partialUpdate(id: number, data: unknown, token?: string): Promise<APIResponse> {
    return this.request.patch(`/booking/${id}`, { data, headers: auth(token) });
  }

  delete(id: number, token?: string): Promise<APIResponse> {
    return this.request.delete(`/booking/${id}`, { headers: auth(token) });
  }
}

/** Restful-Booker takes the token as a cookie. */
function auth(token?: string): Record<string, string> {
  return token ? { Cookie: `token=${token}` } : {};
}
