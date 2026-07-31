package com.starttoo.backend.dm.application;

import com.starttoo.backend.dm.api.DmDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DmRealtimeEventPublisher {

    private final ApplicationEventPublisher eventPublisher;

    public void messageCreated(Integer receiverSeq, DmDtos.MessageResponse message) {
        eventPublisher.publishEvent(new DmRealtimeDeliveryEvent(
                receiverSeq,
                DmDtos.RealtimeEvent.messageCreated(message)
        ));
    }

    public void messagesRead(
            Integer receiverSeq,
            Long roomSeq,
            Integer readerSeq,
            java.time.OffsetDateTime readDttm,
            int changedMessageCount
    ) {
        eventPublisher.publishEvent(new DmRealtimeDeliveryEvent(
                receiverSeq,
                DmDtos.RealtimeEvent.messagesRead(
                        roomSeq,
                        readerSeq,
                        readDttm,
                        changedMessageCount
                )
        ));
    }

}
