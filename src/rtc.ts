/**
 * Free 1-on-1 video calls: the video goes straight between the two devices (WebRTC). The backend only passes the
 * short set-up messages (Supabase Realtime, or BroadcastChannel between two tabs in the demo).
 * No relay (TURN) server: on a few strict mobile or office networks the two devices can't reach each other; the
 * screen then says so instead of pretending.
 */
import type { Backend, SignalChannel } from './backend/types';

export type CallStatus = 'waiting' | 'connecting' | 'connected' | 'unreachable' | 'ended';

type Msg =
  | { t: 'hello'; from: string }
  | { t: 'offer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { t: 'answer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { t: 'ice'; from: string; to: string; candidate: RTCIceCandidateInit }
  | { t: 'bye'; from: string };

const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

export class Call {
  private readonly id = Math.random().toString(36).slice(2);
  private pc: RTCPeerConnection | null = null;
  private peer: string | null = null;
  private channel: SignalChannel | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private failTimer: number | undefined;

  constructor(
    private readonly backend: Backend,
    private readonly room: string,
    private readonly local: MediaStream,
    private readonly onRemote: (stream: MediaStream | null) => void,
    private readonly onStatus: (status: CallStatus) => void
  ) {}

  start(): void {
    this.channel = this.backend.signal(this.room, m => void this.handle(m as Msg));
    this.onStatus('waiting');
    // Say hello now and once more shortly after, in case the channel was still connecting.
    this.send({ t: 'hello', from: this.id });
    window.setTimeout(() => this.peer === null && this.send({ t: 'hello', from: this.id }), 1500);
  }

  leave(): void {
    this.send({ t: 'bye', from: this.id });
    this.closePeer();
    this.channel?.close();
    this.channel = null;
    this.onStatus('ended');
  }

  private send(m: Msg) {
    this.channel?.send(m);
  }

  private closePeer() {
    window.clearTimeout(this.failTimer);
    this.pc?.close();
    this.pc = null;
    this.peer = null;
    this.pendingIce = [];
    this.onRemote(null);
  }

  private makePeer(peer: string): RTCPeerConnection {
    this.closePeer();
    this.peer = peer;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.local.getTracks().forEach(track => pc.addTrack(track, this.local));
    // Camera or mic blocked on this device: still receive the other person.
    if (this.local.getVideoTracks().length === 0) pc.addTransceiver('video', { direction: 'recvonly' });
    if (this.local.getAudioTracks().length === 0) pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.ontrack = e => this.onRemote(e.streams[0] ?? new MediaStream([e.track]));
    pc.onicecandidate = e => {
      if (e.candidate && this.peer) this.send({ t: 'ice', from: this.id, to: this.peer, candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        window.clearTimeout(this.failTimer);
        this.onStatus('connected');
      } else if (pc.connectionState === 'failed') {
        this.onStatus('unreachable');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        this.onStatus('waiting');
      }
    };
    this.onStatus('connecting');
    this.failTimer = window.setTimeout(() => pc.connectionState !== 'connected' && this.onStatus('unreachable'), 20_000);
    this.pc = pc;
    return pc;
  }

  private async handle(m: Msg) {
    if (!m || typeof m !== 'object' || m.from === this.id) return;
    if ('to' in m && m.to !== this.id) return;
    try {
      if (m.t === 'hello') {
        // The device with the larger id makes the offer; the other answers its hello so it learns we're here.
        if (this.id > m.from) {
          if (this.peer === m.from && this.pc && this.pc.connectionState !== 'failed') return; // already setting up with them
          const pc = this.makePeer(m.from);
          await pc.setLocalDescription(await pc.createOffer());
          this.send({ t: 'offer', from: this.id, to: m.from, sdp: pc.localDescription!.toJSON() });
        } else if (this.peer !== m.from) {
          this.send({ t: 'hello', from: this.id });
        }
      } else if (m.t === 'offer') {
        const pc = this.makePeer(m.from);
        await pc.setRemoteDescription(m.sdp);
        await this.flushIce();
        await pc.setLocalDescription(await pc.createAnswer());
        this.send({ t: 'answer', from: this.id, to: m.from, sdp: pc.localDescription!.toJSON() });
      } else if (m.t === 'answer' && this.pc && this.peer === m.from) {
        await this.pc.setRemoteDescription(m.sdp);
        await this.flushIce();
      } else if (m.t === 'ice' && this.peer === m.from) {
        if (this.pc?.remoteDescription) await this.pc.addIceCandidate(m.candidate);
        else this.pendingIce.push(m.candidate);
      } else if (m.t === 'bye' && this.peer === m.from) {
        this.closePeer();
        this.onStatus('waiting');
      }
    } catch {
      this.onStatus('unreachable');
    }
  }

  private async flushIce() {
    const list = this.pendingIce;
    this.pendingIce = [];
    for (const c of list) await this.pc?.addIceCandidate(c).catch(() => undefined);
  }
}
