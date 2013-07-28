#! /usr/bin/env python

import os
import traceback
import sys
import socket
import json
import datetime
import time
import random
import uuid
from collections import deque
from multiprocessing import Process

import tornado.ioloop
import tornado.tcpserver
import tornado.httpserver
import tornado.websocket

import imc.async
from imc.proxy import Proxy,Connection
from imc.blobclient import BlobClient

import mod
import netio
from netio import SocketStream,SocketConnection
from netio import WebSocketStream,WebSocketConnection
from tojauth import TOJAuth

from test_blob import TOJBlobTable,TOJBlobHandle

class StdLogger(object):
    def __init__(self,callback):
        self._callback = callback

    def write(self,data):
        self._callback(data)

    def flush(self):
        pass

class BackendWorker(tornado.tcpserver.TCPServer):
    def __init__(self,center_addr,ws_port):
        super().__init__()

        self._log = StdLogger(self._send_log)
        self._ioloop = tornado.ioloop.IOLoop.current()
        self.center_addr = center_addr
        self.sock_addr = None
        self.ws_port = ws_port

        self._link = None
        self._idendesc = None
        self._pend_mainconn_linkmap = {}
        self._pend_filekeymap = {}
        self._client_linkmap = {}

    def start(self):
        #sys.stdout = self._log
        #sys.stderr = self._log

        sock_port = random.randrange(4096,8192)
        self.sock_addr = ('10.8.0.6',sock_port)

        self.bind(sock_port,'',socket.AF_INET,65536)
        super().start()

        self._conn_center()

    def handle_stream(self,stream,addr):
        def _recv_conn_info(data):
            info = json.loads(data.decode('utf-8'))

            try:
                conntype = info['conntype']

            except KeyError:
                socket_stream.close()

            if conntype == 'main':
                self._handle_mainconn(sock_stream,addr,info)

            elif conntype == 'file':
                self._handle_fileconn(sock_stream,addr,info)

            else:
                socket_stream.close()

        fd = stream.fileno()
        self._ioloop.remove_handler(fd)
        sock_stream = SocketStream(socket.fromfd(fd,socket.AF_INET,socket.SOCK_STREAM | socket.SOCK_NONBLOCK,0))

        netio.recv_pack(sock_stream,_recv_conn_info)

    def add_client(self,link,main_stream):
        @imc.async.caller
        def _call():
            with TOJAuth.change_current_iden(self._idendesc):
                Proxy.instance.call(self.center_conn.link + 'core/','add_client',10000,link,self._link)

        self._client_linkmap[link] = {}

        conn = netio.WebSocketConnection(link,main_stream,self.pend_filestream,
                                         self.del_pend_filestream)
        conn.add_close_callback(lambda conn : self.del_client(conn.link))
        Proxy.instance.add_conn(conn)

        _call()

    def del_client(self,link):
        @imc.async.caller
        def _call():
            with TOJAuth.change_current_iden(self._idendesc):
                Proxy.instance.call(self.center_conn.link + 'core/','del_client',10000,link,self._link)

        del self._client_linkmap[link]

        _call()
    
    def pend_filestream(self,streamtype,filekey,callback,count = 1):
        assert(filekey not in self._pend_filekeymap)

        self._pend_filekeymap[filekey] = {
            'streamtype':streamtype,
            'count':count,
            'stream':[],
            'callback':tornado.stack_context.wrap(callback)
        }

    def add_filestream(self,streamtype,filekey,stream):
        try:
            pend = self._pend_filekeymap[filekey]

        except KeyError:
            raise

        assert(pend['streamtype'] == streamtype)

        pend['count'] -= 1
        if pend['count'] == 0:
            self._pend_filekeymap.pop(filekey)

        pend['callback'](stream)

    def del_pend_filestream(self,filekey):
        self._pend_filekeymap.pop(filekey,None)

    def _conn_center(self):
        def __retry(conn):
            print('retry connect center')

            self.center_conn = None
            self._ioloop.add_timeout(datetime.timedelta(seconds = 5),self._conn_center)

        def __send_worker_info():
            def ___recv_info_cb(data):
                info = json.loads(data.decode('utf-8'))
                pubkey = open('pubkey.pem','r').read()
                TOJAuth(pubkey)

                self._idendesc = info['idendesc']
                self._link = info['worker_link']
                Proxy(self._link,TOJAuth.instance,self._idendesc,self._conn_link)

                self.center_conn = SocketConnection(info['center_link'],stream,
                                                    self.center_addr,
                                                    self.pend_filestream,
                                                    self.del_pend_filestream)
                self.center_conn.add_close_callback(__retry)
                Proxy.instance.add_conn(self.center_conn)

                #self._init_blobclient()

                #Proxy.instance.register_call('test/','get_client_list',self._test_get_client_list)
                Proxy.instance.register_call('test/','test_dst',self._test_dst)
                #Proxy.instance.register_filter('test/',self._test_filter)

                try:
                    mod.load('Notice','notice',self._idendesc,self._get_link)
                    mod.load('UserMg','user',self._idendesc,self._get_link)
                    mod.load('SquareMg','square',self._idendesc,self._get_link)
                    mod.load('ProblemMg','problem',self._idendesc,self._get_link)
                    mod.load('Mail','mail',self._idendesc,self._get_link)

                except Exception as e:
                    print(e)

                if self._link == '/backend/2/':
                    self._test_call(None)

            sock_ip,sock_port = self.sock_addr
            netio.send_pack(stream,bytes(json.dumps({
                'conntype':'main',
                'linkclass':'backend',
                'sock_ip':sock_ip,
                'sock_port':sock_port,
                'ws_ip':'210.70.137.215',
                'ws_port':self.ws_port
            }),'utf-8'))
            netio.recv_pack(stream,___recv_info_cb)

        stream = SocketStream(socket.socket(socket.AF_INET,socket.SOCK_STREAM,0))
        stream.set_close_callback(__retry)
        stream.connect(self.center_addr,__send_worker_info)

    @imc.async.caller
    def _init_blobclient(self):
        blobclient = BlobClient(Proxy.instance,
                                TOJAuth.instance,
                                self._idendesc,
                                self._link,
                                self.center_conn.link,
                                'blobtmp/' + str(self.ws_port - 79),
                                TOJBlobTable(self.ws_port - 79),
                                TOJBlobHandle)
        
        print(self.ws_port, "open cantainer test")
        print(blobclient.open_container('test','ACTIVE'))
        # if False:
        if self.ws_port == 81:
            handle = blobclient.open(
                'test','testblob',
                TOJBlobHandle.WRITE | TOJBlobHandle.CREATE
            )

            print(handle._fileno)
            handle.write(bytes('Hello Data','utf-8'),0)
            print('create commit:', handle.commit(False))
            handle.close()
            print("#########################################################")
            # print("wait for 3 secs...")
            # time.sleep(3)
            # try:
                # handle = blobclient.open(
                    # 'test', 'testblob',
                    # TOJBlobHandle.CREATE
                # )
            # except ValueError as e:
                # print("catch ValueError:", str(e))
            # print("#########################################################")
            # print("wait for 3 secs...")
            # time.sleep(3)
            # handle = blobclient.open(
                # 'test', 'testblob',
                # TOJBlobHandle.WRITE
            # )
            # handle.write(bytes('Hello new line\n','utf-8'),30)
            # print('write commit:', handle.commit(False))
            # handle.close()
            # print("#########################################################")
            # print("wait for 3 secs...")
            # time.sleep(3)
            # handle = blobclient.open(
                # 'test', 'testblob',
                # TOJBlobHandle.WRITE | TOJBlobHandle.DELETE
            # )
            # handle.delete()
            # print('delete commit:', handle.commit(False))
            # handle.close()
            blobclient.clean()
        blobclient.show_status()

    def _conn_link(self,link):
        def __handle_pend(conn):
            try:
                retids = self._pend_mainconn_linkmap.pop(worker_link)
            
            except KeyError:
                return

            for retid in retids:
                imc.async.ret(retid,conn)

        def __conn_cb():
            conn = Proxy.instance.get_conn(worker_link)
            if conn != None:
                __handle_pend(conn)
                main_stream.set_close_callback(None)
                main_stream.close()
            
            else:
                sock_ip,sock_port = self.sock_addr
                netio.send_pack(main_stream,bytes(json.dumps({
                    'conntype':'main',
                    'link':self._link,
                    'sock_ip':sock_ip,
                    'sock_port':sock_port
                }),'utf-8'))
                netio.recv_pack(main_stream,__recv_cb)

        def __recv_cb(data):
            stat = json.loads(data.decode('utf-8'))
            if stat == True:
                conn = SocketConnection(worker_link,main_stream,sock_addr,
                                        self.pend_filestream,
                                        self.del_pend_filestream)
                Proxy.instance.add_conn(conn)
                __handle_pend(conn)

            else:
                main_stream.set_close_callback(None)
                main_stream.close()
        
        if self.center_conn == None:
            return None

        with TOJAuth.change_current_iden(self._idendesc):
            stat,ret = Proxy.instance.call(self.center_conn.link + 'core/','lookup_link',65536,link)

        if stat == False or ret == None:
            return None

        else:
            worker_link = ret['worker_link']

            conn = Proxy.instance.get_conn(worker_link)
            if conn != None:
                return conn

            elif worker_link in self._pend_mainconn_linkmap:
                self._pend_mainconn_linkmap[worker_link].append(imc.async.get_retid())
                return imc.async.switch_top()

            else:
                self._pend_mainconn_linkmap[worker_link] = [imc.async.get_retid()]

                sock_addr = (ret['sock_ip'],ret['sock_port'])

                main_stream = SocketStream(socket.socket(socket.AF_INET,socket.SOCK_STREAM,0))
                main_stream.set_close_callback(lambda conn : __handle_pend(None))
                main_stream.connect(sock_addr,__conn_cb)

                return imc.async.switch_top()

    def _handle_mainconn(self,main_stream,addr,info):
        link = info['link']
        sock_ip = info['sock_ip']
        sock_port = info['sock_port']

        conn = Proxy.instance.get_conn(link)
        if conn != None:
            return

        if (link not in self._pend_mainconn_linkmap) or self._link > link:
            conn = SocketConnection(link,main_stream,(sock_ip,sock_port),
                                    self.pend_filestream,
                                    self.del_pend_filestream)
            Proxy.instance.add_conn(conn)

            netio.send_pack(main_stream,bytes(json.dumps(True),'utf-8'))
            
            if link in self._pend_mainconn_linkmap:
                retids = self._pend_mainconn_linkmap.pop(link)
                for retid in retids:
                    imc.async.ret(retid,conn)

        else:
            netio.send_pack(main_stream,bytes(json.dumps(False),'utf-8'))
        
    def _handle_fileconn(self,file_stream,addr,info):
        try:
            self.add_filestream('socket',info['filekey'],file_stream)

        except Exception:
            file_stream.close()

    def _get_link(self,linkclass,uid = 0):
        if linkclass == 'center':
            return self.center_conn.link

        elif linkclass == 'client':
            stat,ret = Proxy.instance.call(self.center_conn.link + 'core/','get_uid_clientlink',10000,uid)
            return ret

    @imc.async.caller
    def _send_log(self,data):
        links = self._client_linkmap.keys()

        with TOJAuth.change_current_iden(self._idendesc):
            for link in links:
                Proxy.instance.call_async(link + 'core/stat/','print_log',10000,None,data)

    @imc.async.caller
    def _test_get_client_list(self,talk,talk2):
        stat,ret = Proxy.instance.call(TOJAuth.get_current_iden()['link'] + 'test/route/','80s',1000,'attation','mega')
        print(ret)

        return list(self._client_linkmap.items())

    @imc.async.caller
    def _test_filter(self,dpart,func_name):
        print(dpart)
        print(func_name)

    @imc.async.caller
    def _test_call(self,param):
        with TOJAuth.change_current_iden(self._idendesc):
            ret = Proxy.instance.call('/backend/3/test/','test_dst',1000,'Hello')
            print(ret)

            '''
            st = time.perf_counter()
            for i in range(0,2):
                dst = '/backend/' + str((i % 2) + 2) + '/'
                if dst == self._link:
                    continue

                fileres = Proxy.instance.sendfile(dst,'Fedora-18-x86_64-DVD.iso')
                ret = Proxy.instance.call_async(dst + 'test/','test_dst',1000,lambda result: print(result),fileres.filekey)
                
                print(fileres.wait())

            print(time.perf_counter() - st)
            print(self._link)
            '''

    @imc.async.caller
    def _test_dst(self,filekey):
        print(filekey)

        fileres = Proxy.instance.recvfile(filekey,'data')

        #self._ioloop.add_timeout(datetime.timedelta(milliseconds = 500),lambda : Proxy.instance.abortfile(filekey))
        #Proxy.instance.abortfile(filekey)
        #fileres = Proxy.instance.recvfile(filekey,'data')
        #print('recv ' + fileres.wait())
        print(fileres.wait())

        return 'ok'

    @imc.async.caller
    def _test_dsta(self,iden,param):
        return param + ' Too'

class WebSocketConnHandler(tornado.websocket.WebSocketHandler):
    def open(self):
        pass

    def on_message(self,msg):
        global backend_worker

        if hasattr(self,'conntype'):
            self.stream.recv_msg(msg)

        else:
            info = json.loads(msg)
            self.conntype = info['conntype']
            self.stream = WebSocketStream(self)

            if self.conntype == 'main':
                self._handle_mainconn(self.stream,info)

            elif self.conntype == 'file':
                self._handle_fileconn(self.stream,info)

            else:
                self.stream.close()

    def on_close(self):
        if hasattr(self,'conntype'):
            self.stream.close()

    def _handle_mainconn(self,main_stream,info):
        global backend_worker

        try:
            backend_worker.add_client(info['client_link'],main_stream)

        except Exception:
            main_stream.close()

    def _handle_fileconn(self,file_stream,info):
        global backend_worker

        try:
            backend_worker.add_filestream('websocket',info['filekey'],
                                          file_stream)
            print('test')

        except Exception as err:
            file_stream.close()
        
def start_backend_worker(ws_port):
    global backend_worker

    http_serv = tornado.httpserver.HTTPServer(tornado.web.Application([
        ('/conn',WebSocketConnHandler)
    ]))
    http_serv.listen(ws_port)

    backend_worker = BackendWorker(('10.8.0.6',5730),ws_port)
    backend_worker.start()

    tornado.ioloop.IOLoop.instance().start()

if __name__ == '__main__':
    worker_list = []

    worker_list.append(Process(target = start_backend_worker,args = (81, )))
    worker_list.append(Process(target = start_backend_worker,args = (82, )))
    #worker_list.append(Process(target = start_backend_worker,args = (181, )))
    #worker_list.append(Process(target = start_backend_worker,args = (182, )))
    #worker_list.append(Process(target = start_backend_worker,args = (183, )))
    #worker_list.append(Process(target = start_backend_worker,args = (184, )))
    #worker_list.append(Process(target = start_backend_worker,args = (185, )))
    #worker_list.append(Process(target = start_backend_worker,args = (186, )))

    for proc in worker_list:
        proc.start()

    for proc in worker_list:
        proc.join()

