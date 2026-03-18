import eventsData from "../../../../specs/data/events.json";
import type { EventConfig, EventDefinition } from "../types";

export const allEvents: EventDefinition[] =
	eventsData.events as EventDefinition[];

export const eventConfig: EventConfig = eventsData.eventConfig as EventConfig;
