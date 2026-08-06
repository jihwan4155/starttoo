package com.starttoo.backend.simulation.application;

import com.starttoo.backend.simulation.api.SimulationDtos;

/**
 * DB 트랜잭션 내부에서 발행되고 커밋 성공 후에만 소비되는 내부 이벤트다.
 * 수신자는 항상 세션을 만든 PC 회원이다. 폰은 로그인이 없어 소켓을 쓰지 않는다.
 */
public record SimulationRealtimeDeliveryEvent(
        Integer receiverSeq,
        SimulationDtos.RealtimeEvent payload
) {
}
