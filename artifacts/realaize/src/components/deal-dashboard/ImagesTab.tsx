import React from 'react';

import { GlassPanel, SectionHeader } from '@/components/shared';

import ImageManager from '@/components/ImageManager';

import type { AcquisitionDeal } from '@/models/types';

export function ImagesTab({ deal }: { deal: AcquisitionDeal }) {
  return (
        <GlassPanel style={{ padding: 24 }} className="animate-fade-in">
          <SectionHeader title="Bilder" />
          <ImageManager entityId={deal.id} entityType="Deal" />
        </GlassPanel>
  );
}
