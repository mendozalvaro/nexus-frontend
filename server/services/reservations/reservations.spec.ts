import { describe, expect, it, vi } from "vitest";
import { formatReservationReceiptNumber } from "@/utils/reservation-receipts";
import { createReservation, reservationRangesOverlap, resolveReservationStatusAfterPayment } from "./reservations";
import { reservationAppearsInStaying } from "../reports/lodging";

describe("reservationRangesOverlap", () => {
  it("detecta cruce normal por fechas", () => {
    expect(reservationRangesOverlap({
      check_in: "2026-06-10",
      check_out: "2026-06-15",
      is_open_ended: false,
    }, "2026-06-12", "2026-06-13")).toBe(true);
  });

  it("bloquea cualquier rango futuro cuando la estadía es indefinida", () => {
    expect(reservationRangesOverlap({
      check_in: "2026-06-10",
      check_out: "2026-06-11",
      is_open_ended: true,
    }, "2026-07-01", "2026-07-02")).toBe(true);
  });

  it("no marca cruce cuando el rango empieza al salir", () => {
    expect(reservationRangesOverlap({
      check_in: "2026-06-10",
      check_out: "2026-06-12",
      is_open_ended: false,
    }, "2026-06-12", "2026-06-14")).toBe(false);
  });
});

describe("reservationAppearsInStaying", () => {
  it("mantiene visible una reserva indefinida en permanencia", () => {
    expect(reservationAppearsInStaying({
      status: "checked_in",
      check_in: "2026-06-10",
      check_out: "2026-06-11",
      actual_check_in_at: "2026-06-10T13:00:00.000Z",
      actual_check_out_at: null,
      is_open_ended: true,
    }, "2026-06-13")).toBe(true);
  });

  it("deja de mostrar permanencia el mismo día del check-in", () => {
    expect(reservationAppearsInStaying({
      status: "checked_in",
      check_in: "2026-06-10",
      check_out: "2026-06-12",
      actual_check_in_at: "2026-06-10T13:00:00.000Z",
      actual_check_out_at: null,
      is_open_ended: false,
    }, "2026-06-10")).toBe(false);
  });

  it("deja de mostrar permanencia al cerrar", () => {
    expect(reservationAppearsInStaying({
      status: "checked_in",
      check_in: "2026-06-10",
      check_out: "2026-06-12",
      actual_check_in_at: "2026-06-10T13:00:00.000Z",
      actual_check_out_at: "2026-06-12T09:00:00.000Z",
      is_open_ended: false,
    }, "2026-06-12")).toBe(false);
  });
});

describe("resolveReservationStatusAfterPayment", () => {
  it("mantiene checked_in aunque entre un pago parcial", () => {
    expect(resolveReservationStatusAfterPayment("checked_in", 300, 50)).toBe("checked_in");
  });

  it("confirma una reserva futura solo al cubrir el total", () => {
    expect(resolveReservationStatusAfterPayment("pending_payment", 300, 300)).toBe("confirmed");
  });

  it("deja pendiente una reserva futura con pago parcial", () => {
    expect(resolveReservationStatusAfterPayment("pending_payment", 300, 100)).toBe("pending_payment");
  });
});

describe("createReservation", () => {
  it("delegates quick check-in to the atomic rpc", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "reservation-id", error: null });
    const context = {
      organizationId: "org-id",
      allowedBranchIds: ["branch-id"],
      adminClient: { rpc },
    } as any;

    const reservationId = await createReservation(context, "user-id", {
      branchId: "branch-id",
      checkIn: "2026-07-05",
      checkOut: "2026-07-06",
      openEnded: false,
      notes: "  ingreso rapido  ",
      rooms: [{
        roomId: "room-id",
        notes: "  nota  ",
        guests: [{
          fullName: "Huesped Demo",
          documentType: "CI",
          documentNumber: "123",
          birthDate: "1990-01-01",
          sex: "male",
          isMainGuest: true,
        }],
      }],
      payment: {
        amount: 50,
        paymentMethod: "cash",
        paymentType: "deposit",
        reference: "ref-1",
      },
    });

    expect(reservationId).toBe("reservation-id");
    expect(rpc).toHaveBeenCalledWith("create_lodging_quick_checkin", expect.objectContaining({
      p_organization_id: "org-id",
      p_branch_id: "branch-id",
      p_created_by: "user-id",
      p_check_in: "2026-07-05",
      p_check_out: "2026-07-06",
      p_notes: "ingreso rapido",
    }));
  });
});

describe("formatReservationReceiptNumber", () => {
  it("usa el mismo correlativo base y agrega sufijo en parciales", () => {
    expect(formatReservationReceiptNumber("REC-2026-000005", "partial", 1)).toBe("REC-2026-000005/01");
    expect(formatReservationReceiptNumber("REC-2026-000005", "final", null)).toBe("REC-2026-000005");
  });
});
