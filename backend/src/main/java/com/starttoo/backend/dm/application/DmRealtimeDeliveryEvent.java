package com.starttoo.backend.dm.application;

import com.starttoo.backend.dm.api.DmDtos;

/**
 * DB 트랜잭션 내부에서 발행되고 커밋 성공 후에만 소비되는 내부 이벤트다.
 */
public record DmRealtimeDeliveryEvent(
        Integer receiverSeq,
        DmDtos.RealtimeEvent payload
) {
}
