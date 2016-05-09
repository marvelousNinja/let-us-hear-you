#!/bin/bash

wsk rule delete --disable sendSmsOnChange
wsk action delete sendSms
