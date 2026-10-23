import {
  type EncoderInfo,
  type ScreenShareCodec,
  SCREEN_SHARE_CODECS,
} from "@revolt/rtc/codecPick";

import { State } from "..";

import { AbstractStore } from ".";

/**
 * Encoder test results for this device, measured at the screen's resolution
 */
export type ScreenShareEncoderResults = {
  width: number;
  height: number;
  /** When the test ran (ms since epoch) */
  at: number;
  encoders: EncoderInfo[];
};

/**
 * Possible noise suppresion states. Browser is browser noise suppresion and enhanced is machine learning suppression via RNNoise.
 */
export type NoiseSuppresionState = "disabled" | "browser" | "enhanced";

const NoiseSuppresionStates: NoiseSuppresionState[] = [
  "disabled",
  "browser",
  "enhanced",
];

/**
 * Possible screen share qualities. Low is 720p@30fps, high 1080p@30fps, text is source@5fps,
 * hd60/qhd60 are 1080p/1440p@60fps and source60 is source@60fps (capped by the server video limit).
 */
export type ScreenShareQualityName =
  | "low"
  | "high"
  | "text"
  | "hd60"
  | "qhd60"
  | "source60";

/**
 * Array of available screen share quality names.
 */
export const ScreenShareQualityNames: ScreenShareQualityName[] = [
  "low",
  "high",
  "text",
  "hd60",
  "qhd60",
  "source60",
];

export interface TypeVoice {
  preferredAudioInputDevice?: string;
  preferredAudioOutputDevice?: string;
  preferredVideoDevice?: string;

  echoCancellation: boolean;
  noiseSupression: NoiseSuppresionState;
  autoGainControl: boolean;

  screenShareQuality: ScreenShareQualityName;
  screenShareQualityAsk: boolean;
  screenShareAudio: boolean;
  screenShareCodec: ScreenShareCodec | "auto";
  screenShareEncoders?: ScreenShareEncoderResults;

  inputVolume: number;
  outputVolume: number;
  deafen: boolean;
  micOn: boolean;

  userVolumes: Record<string, number>;
  userMutes: Record<string, boolean>;

  screenShareVolumes: Record<string, number>;
  screenShareMutes: Record<string, boolean>;
}

/**
 * Handles enabling and disabling client experiments.
 */
export class Voice extends AbstractStore<"voice", TypeVoice> {
  /**
   * Construct store
   * @param state State
   */
  constructor(state: State) {
    super(state, "voice");
  }

  /**
   * Hydrate external context
   */
  hydrate(): void {
    /** nothing needs to be done */
  }

  /**
   * Generate default values
   */
  default(): TypeVoice {
    return {
      echoCancellation: true,
      noiseSupression: "enhanced",
      autoGainControl: true,
      screenShareQuality: "low",
      screenShareQualityAsk: true,
      screenShareAudio: true,
      screenShareCodec: "auto",
      inputVolume: 1.0,
      outputVolume: 1.0,
      deafen: false,
      micOn: true,
      userVolumes: {},
      userMutes: {},
      screenShareVolumes: {},
      screenShareMutes: {},
    };
  }

  /**
   * Validate the given data to see if it is compliant and return a compliant object
   */
  clean(input: Partial<TypeVoice>): TypeVoice {
    const data = this.default();

    if (typeof input.preferredAudioInputDevice === "string") {
      data.preferredAudioInputDevice = input.preferredAudioInputDevice;
    }

    if (typeof input.preferredAudioOutputDevice === "string") {
      data.preferredAudioOutputDevice = input.preferredAudioOutputDevice;
    }

    if (typeof input.preferredVideoDevice === "string") {
      data.preferredVideoDevice = input.preferredVideoDevice;
    }

    if (typeof input.echoCancellation === "boolean") {
      data.echoCancellation = input.echoCancellation;
    }

    // migrate legacy noise suppression to new suppression state
    if ((input.noiseSupression as unknown) === "true") {
      data.noiseSupression = "enhanced";
    } else if ((input.noiseSupression as unknown) === "false") {
      data.noiseSupression = "disabled";
    } else if (
      input.noiseSupression &&
      NoiseSuppresionStates.includes(input.noiseSupression)
    ) {
      data.noiseSupression = input.noiseSupression;
    }

    if (typeof input.autoGainControl === "boolean") {
      data.autoGainControl = input.autoGainControl;
    }

    if (
      input.screenShareQuality &&
      ScreenShareQualityNames.includes(input.screenShareQuality)
    ) {
      data.screenShareQuality = input.screenShareQuality;
    }

    if (typeof input.screenShareQualityAsk === "boolean") {
      data.screenShareQualityAsk = input.screenShareQualityAsk;
    }

    if (typeof input.screenShareAudio === "boolean") {
      data.screenShareAudio = input.screenShareAudio;
    }

    if (
      input.screenShareCodec === "auto" ||
      SCREEN_SHARE_CODECS.includes(input.screenShareCodec as ScreenShareCodec)
    ) {
      data.screenShareCodec = input.screenShareCodec!;
    }

    const results = input.screenShareEncoders;
    if (
      results &&
      typeof results.width === "number" &&
      typeof results.height === "number" &&
      typeof results.at === "number" &&
      Array.isArray(results.encoders)
    ) {
      data.screenShareEncoders = {
        width: results.width,
        height: results.height,
        at: results.at,
        encoders: results.encoders.filter(
          (e) =>
            SCREEN_SHARE_CODECS.includes(e.codec) &&
            typeof e.supported === "boolean" &&
            typeof e.gpu === "boolean" &&
            (e.fps === undefined || typeof e.fps === "number"),
        ),
      };
    }

    if (typeof input.inputVolume === "number") {
      data.inputVolume = input.inputVolume;
    }

    if (typeof input.outputVolume === "number") {
      data.outputVolume = input.outputVolume;
    }

    if (typeof input.deafen === "boolean") {
      data.deafen = input.deafen;
    }

    if (typeof input.micOn === "boolean") {
      data.micOn = input.micOn;
    }

    if (typeof input.userVolumes === "object") {
      Object.entries(input.userVolumes)
        .filter(
          ([userId, volume]) =>
            typeof userId === "string" && typeof volume === "number",
        )
        .forEach(([k, v]) => (data.userVolumes[k] = v));
    }

    if (typeof input.userMutes === "object") {
      Object.entries(input.userMutes)
        .filter(
          ([userId, muted]) => typeof userId === "string" && muted === true,
        )
        .forEach(([k, v]) => (data.userMutes[k] = v));
    }

    if (typeof input.screenShareVolumes === "object") {
      Object.entries(input.screenShareVolumes)
        .filter(
          ([userId, volume]) =>
            typeof userId === "string" && typeof volume === "number",
        )
        .forEach(([k, v]) => (data.screenShareVolumes[k] = v));
    }

    if (typeof input.screenShareMutes === "object") {
      Object.entries(input.screenShareMutes)
        .filter(
          ([userId, muted]) => typeof userId === "string" && muted === true,
        )
        .forEach(([k, v]) => (data.screenShareMutes[k] = v));
    }

    return data;
  }

  /**
   * Set a user's volume
   * @param userId User ID
   * @param volume Volume
   */
  setUserVolume(userId: string, volume: number) {
    this.set("userVolumes", userId, volume);
  }

  /**
   * Get a user's volume
   * @param userId User ID
   * @returns Volume or default
   */
  getUserVolume(userId: string): number {
    return this.get().userVolumes[userId] || 1.0;
  }

  /**
   * Set whether a user is muted
   * @param userId User ID
   * @param muted Whether they should be muted
   */
  setUserMuted(userId: string, muted: boolean) {
    this.set("userMutes", userId, muted);
  }

  /**
   * Get whether a user is muted
   * @param userId User ID
   * @returns Whether muted
   */
  getUserMuted(userId: string): boolean {
    return this.get().userMutes[userId] || false;
  }

  /**
   * Set a user's screen share volume
   * @param userId User ID
   * @param volume Volume
   */
  setScreenShareVolume(userId: string, volume: number) {
    this.set("screenShareVolumes", userId, volume);
  }

  /**
   * Get a user's screen share volume
   * @param userId User ID
   * @returns Volume or default
   */
  getScreenShareVolume(userId: string): number {
    return this.get().screenShareVolumes[userId] || 1.0;
  }

  /**
   * Set whether a user's screen share is muted
   * @param userId User ID
   * @param muted Whether they should be muted
   */
  setScreenShareMuted(userId: string, muted: boolean) {
    this.set("screenShareMutes", userId, muted);
  }

  /**
   * Get whether a user's screen share is muted
   * @param userId User ID
   * @returns Whether muted
   */
  getScreenShareMuted(userId: string): boolean {
    return this.get().screenShareMutes[userId] ?? true;
  }

  /**
   * Set the preferred audio input device
   */
  set preferredAudioInputDevice(value: string | undefined) {
    this.set("preferredAudioInputDevice", value);
  }

  /**
   * Set the preferred audio output device
   */
  set preferredAudioOutputDevice(value: string | undefined) {
    this.set("preferredAudioOutputDevice", value);
  }

  /**
   * Set the preferred video input device
   */
  set preferredVideoDevice(value: string | undefined) {
    this.set("preferredVideoDevice", value);
  }

  /**
   * Set echo cancellation
   */
  set echoCancellation(value: boolean) {
    this.set("echoCancellation", value);
  }

  /**
   * Set noise cancellation
   */
  set noiseSupression(value: NoiseSuppresionState) {
    this.set("noiseSupression", value);
  }

  /**
   * Set auto gain control
   */
  set autoGainControl(value: boolean) {
    this.set("autoGainControl", value);
  }

  /**
   * Set screen share quality
   */
  set screenShareQuality(value: ScreenShareQualityName) {
    this.set("screenShareQuality", value);
  }

  /**
   * Set screen share quality always ask
   */
  set screenShareQualityAsk(value: boolean) {
    this.set("screenShareQualityAsk", value);
  }

  /**
   * Set screen share audio
   */
  set screenShareAudio(value: boolean) {
    this.set("screenShareAudio", value);
  }

  /**
   * Set screen share codec ("auto" picks from this device's encoder results)
   */
  set screenShareCodec(value: ScreenShareCodec | "auto") {
    this.set("screenShareCodec", value);
  }

  /**
   * Set encoder test results for this device
   */
  set screenShareEncoders(value: ScreenShareEncoderResults | undefined) {
    this.set("screenShareEncoders", value);
  }

  /**
   * Set input volume
   */
  set inputVolume(value: number) {
    this.set("inputVolume", value);
  }

  /**
   * Set output volume
   */
  set outputVolume(value: number) {
    this.set("outputVolume", value);
  }

  /**
   * Set mic status
   */
  set micOn(value: boolean) {
    this.set("micOn", value);
  }

  /**
   * Set deafen status
   */
  set deafen(value: boolean) {
    this.set("deafen", value);
  }

  /**
   * Get the preferred audio input device
   */
  get preferredAudioInputDevice(): string | undefined {
    return this.get().preferredAudioInputDevice;
  }

  /**
   * Get the preferred audio output device
   */
  get preferredAudioOutputDevice(): string | undefined {
    return this.get().preferredAudioOutputDevice;
  }

  /**
   * Get the preferred video input device
   */
  get preferredVideoDevice(): string | undefined {
    return this.get().preferredVideoDevice;
  }

  /**
   * Get echo cancellation
   */
  get echoCancellation(): boolean | undefined {
    return this.get().echoCancellation;
  }

  /**
   * Get noise supression
   */
  get noiseSupression(): NoiseSuppresionState | undefined {
    return this.get().noiseSupression;
  }

  /**
   * Get auto gain control
   */
  get autoGainControl(): boolean | undefined {
    return this.get().autoGainControl;
  }

  /**
   * Get screen share quality
   */
  get screenShareQuality(): ScreenShareQualityName | undefined {
    return this.get().screenShareQuality;
  }

  /**
   * Get screen share quality always ask
   */
  get screenShareQualityAsk(): boolean {
    return this.get().screenShareQualityAsk;
  }

  /**
   * Get screen share audio
   */
  get screenShareAudio(): boolean {
    return this.get().screenShareAudio;
  }

  /**
   * Get screen share codec
   */
  get screenShareCodec(): ScreenShareCodec | "auto" {
    return this.get().screenShareCodec;
  }

  /**
   * Get encoder test results for this device
   */
  get screenShareEncoders(): ScreenShareEncoderResults | undefined {
    return this.get().screenShareEncoders;
  }

  /**
   * Get input volume
   */
  get inputVolume(): number {
    return this.get().inputVolume;
  }

  /**
   * Get output volume
   */
  get outputVolume(): number {
    return this.get().outputVolume;
  }

  /**
   * Get deafen status
   */
  get deafen(): boolean {
    return this.get().deafen;
  }

  /**
   * Get mic status
   */
  get micOn(): boolean {
    return this.get().micOn;
  }
}
