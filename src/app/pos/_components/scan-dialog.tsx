"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { Camera, X } from "lucide-react";
import { lookupMemberByQr } from "@/app/pos/actions";
import type { MemberSummary } from "@/server/loyalty";
import { useGSAP } from "@/components/motion/gsap";
import { gsap, MOTION, prefersReducedMotion } from "@/components/motion/gsap";

type ScanDialogProps = { onClose: () => void; onAttach: (member: MemberSummary) => void; onLookupStart: () => void; onLookupEnd: (error?: string) => void };

export function ScanDialog({ onClose, onAttach, onLookupStart, onLookupEnd }: ScanDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const backdropStartedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stoppedRef = useRef(false);
  const handlingRef = useRef(false);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(true);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    const corners = gsap.utils.toArray<SVGPathElement>("[data-scan-corner]", dialogRef.current);
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: MOTION.base, ease: MOTION.ease });
    gsap.fromTo(dialogRef.current, { y: 12, scale: 0.985, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: MOTION.base, ease: MOTION.ease });
    gsap.fromTo(corners, { drawSVG: "0%" }, { drawSVG: "100%", duration: MOTION.base, stagger: MOTION.stagger, ease: MOTION.ease });
    const line = dialogRef.current?.querySelector<HTMLElement>("[data-scan-line]");
    if (line) gsap.fromTo(line, { yPercent: -110, opacity: 0.35 }, { yPercent: 110, opacity: 0.8, duration: 1.8, repeat: -1, yoyo: true, ease: "sine.inOut" });
  }, { scope: dialogRef });

  const submitToken = useCallback(async (token: string) => {
    if (!token.trim() || handlingRef.current) return;
    handlingRef.current = true;
    setError("");
    onLookupStart();
    onClose();
    try {
      const member = await lookupMemberByQr(token.trim());
      if (member) onAttach(member);
      else onLookupEnd("ไม่พบสมาชิกหรือ QR หมดอายุ");
    } catch {
      onLookupEnd("ค้นหาสมาชิกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      handlingRef.current = false;
    }
  }, [onAttach, onClose, onLookupEnd, onLookupStart]);

  useEffect(() => {
    stoppedRef.current = false;
    dialogRef.current?.focus();
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const reader = new BrowserQRCodeReader();
    const videoElement = videoRef.current;
    let controls: { stop: () => void } | undefined;
    const stopStream = () => {
      const stream = videoElement?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    };
    const start = async () => {
      try {
        const devices = await BrowserQRCodeReader.listVideoInputDevices();
        if (stoppedRef.current || !videoElement) return;
        const device = devices.find((item) => /back|rear|environment/i.test(item.label)) ?? devices[0];
        controls = await reader.decodeFromVideoDevice(device?.deviceId, videoElement, (result) => {
          if (result && !handlingRef.current) void submitToken(result.getText());
        });
        if (stoppedRef.current) { controls.stop(); stopStream(); }
      } catch {
        if (!stoppedRef.current) {
          setScanning(false);
          setError("เปิดกล้องไม่ได้ กรุณาใช้เครื่องสแกนหรือป้อนรหัสสมาชิก");
        }
      }
    };
    void start();
    return () => {
      stoppedRef.current = true;
      window.clearTimeout(focusTimer);
      controls?.stop();
      stopStream();
    };
  }, [submitToken]);

  return <div ref={backdropRef} className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,30,22,0.55)] p-4" onPointerDown={(event) => { backdropStartedRef.current = event.target === event.currentTarget; }} onClick={(event) => { if (backdropStartedRef.current && event.target === event.currentTarget) onClose(); backdropStartedRef.current = false; }}>
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="scan-title" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}
      className="relative flex w-[min(560px,calc(100vw-32px))] flex-col items-center gap-4 rounded-3xl bg-[#FFFBF6] p-6 outline-none">
      <button type="button" aria-label="ปิดหน้าต่าง" onClick={onClose} className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-xl text-[#6B5547]"><X aria-hidden="true" /></button>
      <h2 id="scan-title" className="text-[22px] font-bold">สแกนบัตรสมาชิก</h2>
      <div className="relative flex h-[280px] w-full items-center justify-center overflow-hidden rounded-2xl bg-[#3B2A20]">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-[14%]">
          <svg className="size-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
            <path data-scan-corner d="M2 22V2H22 M78 2H98V22 M98 78V98H78 M22 98H2V78" stroke="#F5EDE3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {scanning && <span data-scan-line className="absolute left-2 right-2 top-1/2 h-[2px] rounded-full bg-[#D9653B] shadow-[0_0_12px_rgba(217,101,59,0.85)]" />}
        </div>
        {!scanning && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#F5EDE3]"><Camera aria-hidden="true" size={38} /><span>พร้อมสแกนเมื่อเปิดกล้องได้</span></div>}
      </div>
      <p className="text-sm text-[#6B5547]">วาง QR ให้อยู่ในกรอบ หรือใช้เครื่องสแกน USB</p>
      <input ref={inputRef} aria-label="รหัส QR สมาชิกจากเครื่องสแกน" autoComplete="off" onKeyDown={(event) => {
        if (event.key === "Enter") { event.preventDefault(); const target = event.currentTarget; void submitToken(target.value); target.value = ""; }
      }} className="fixed left-0 top-0 size-px opacity-0" />
      {error && <p role="alert" className="w-full rounded-xl bg-[#F7DCD0] p-3 text-center font-semibold text-[#8E3415]">{error}</p>}
      <button type="button" onClick={onClose} className="h-[60px] w-full rounded-[14px] border border-[#D9C5B0] bg-[#FFFBF6] text-[17px] font-semibold">ยกเลิก</button>
    </div>
  </div>;
}
