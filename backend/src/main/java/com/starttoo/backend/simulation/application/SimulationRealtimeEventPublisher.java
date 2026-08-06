package com.starttoo.backend.simulation.application;

import com.starttoo.backend.simulation.api.SimulationDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class SimulationRealtimeEventPublisher {

    private final ApplicationEventPublisher eventPublisher;

    public void phoneConnected(Integer ownerSeq, UUID sessionId) {
        eventPublisher.publishEvent(new SimulationRealtimeDeliveryEvent(
                ownerSeq,
                SimulationDtos.RealtimeEvent.phoneConnected(sessionId)
        ));
    }

    public void compositeCreated(
            Integer ownerSeq,
            UUID sessionId,
            SimulationDtos.CompositeResponse composite
    ) {
        eventPublisher.publishEvent(new SimulationRealtimeDeliveryEvent(
                ownerSeq,
                SimulationDtos.RealtimeEvent.compositeCreated(sessionId, composite)
        ));
    }

    public void sessionClosed(Integer ownerSeq, UUID sessionId) {
        eventPublisher.publishEvent(new SimulationRealtimeDeliveryEvent(
                ownerSeq,
                SimulationDtos.RealtimeEvent.sessionClosed(sessionId)
        ));
    }
}
