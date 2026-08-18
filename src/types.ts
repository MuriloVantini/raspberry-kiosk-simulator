export interface Device {
  id: number;
  name: string;
  type?: string;
  location?: string;
  is_online?: boolean;
  profile_name?: string | null;
  profile_image_url?: string | null;
}

export interface Delivery {
  id: number;
  alert?: {
    type?: "info" | "success" | "warning" | "critical";
    title?: string;
    message?: string;
    duration_seconds?: number;
  };
}

export interface ConnectionState {
  connected: boolean;
  lastError?: string | null;
  device?: Device;
}
