cf service analyst-cloudant || cf create-service cloudantNoSQLDB Shared analyst-cloudant
cf service analyst-object-storage || cf create-service Object-Storage Free analyst-object-storage
cf service analyst-speech-to-text || cf create-service speech_to_text standard analyst-speech-to-text
cf service analyst-tone-analyzer || cf create-service tone_analyzer beta analyst-tone-analyzer

cf service-keys analyst-cloudant | find "Credentials-1" || cf create-service-key analyst-cloudant Credentials-1
cf service-keys analyst-object-storage | find "Credentials-1" || cf create-service-key analyst-object-storage Credentials-1
cf service-keys analyst-speech-to-text | find "Credentials-1" || cf create-service-key analyst-speech-to-text Credentials-1
cf service-keys analyst-tone-analyzer | find "Credentials-1" || cf create-service-key analyst-tone-analyzer Credentials-1
