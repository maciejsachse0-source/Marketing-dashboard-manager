import type {
  ProductionStage,
  ProductionStatus,
  ProductionType,
} from '../../drizzle/schema';

export type TemplateCustomStep = {
  category: ProductionStage;
  label: string;
  positionAfter: ProductionStatus;
  description?: string;
};

export type ProductionTemplate = {
  slug: string;
  name: string;
  type: ProductionType;
  summary: string;
  description: string;
  customSteps: TemplateCustomStep[];
};
